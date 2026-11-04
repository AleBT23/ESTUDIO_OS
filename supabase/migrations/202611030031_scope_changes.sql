alter table public.quotes add unique(organization_id,client_id,id);
create table public.scope_changes(
 id uuid primary key, organization_id uuid not null, client_id uuid not null, project_id uuid not null,quote_id uuid unique,
 description text not null check(length(trim(description)) between 2 and 6000),
 days_impact int not null check(days_impact between -3650 and 3650),
 created_at timestamptz not null default now(),created_by uuid not null default auth.uid() references auth.users(id),
 unique(organization_id,project_id,id),
 foreign key(organization_id,client_id,project_id) references public.projects(organization_id,client_id,id),
 foreign key(organization_id,client_id,quote_id) references public.quotes(organization_id,client_id,id)
);
alter table public.scope_changes enable row level security;
revoke all on public.scope_changes from public,anon,authenticated;
grant select on public.scope_changes to authenticated;
grant insert(id,organization_id,client_id,project_id,description,days_impact),update(quote_id) on public.scope_changes to authenticated;
create policy change_admin on public.scope_changes for all to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]))
 with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]) and exists(select 1 from public.projects p where p.organization_id=scope_changes.organization_id and p.id=scope_changes.project_id and p.deleted_at is null and p.state in ('active','paused')));
create function private.bind_change_quote() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(new.organization_id,array['owner','admin']::public.member_role[]) or old.quote_id is not null or new.quote_id is null then raise exception 'Vínculo de cotización inválido';end if;
 perform 1 from public.quotes where organization_id=new.organization_id and client_id=new.client_id and id=new.quote_id and status='draft' and deleted_at is null for update;
 if not found then raise exception 'Selecciona un borrador del mismo cliente';end if;
 return new;
end $$;
revoke all on function private.bind_change_quote() from public,anon,authenticated;
create trigger change_bind before update of quote_id on public.scope_changes for each row execute function private.bind_change_quote();
alter table public.payment_schedules add column scope_change_id uuid,add foreign key(organization_id,project_id,scope_change_id) references public.scope_changes(organization_id,project_id,id);
alter table public.project_service_packages add column scope_change_id uuid,add foreign key(organization_id,project_id,scope_change_id) references public.scope_changes(organization_id,project_id,id);
create or replace function public.accept_quote(org uuid,quote uuid,expected_version integer,advance_due date,balance_due date) returns uuid
language plpgsql security definer set search_path='' as $$
declare change public.scope_changes;q public.quotes;v public.quote_versions;project uuid;pkg uuid;line uuid;advance bigint;net bigint;items jsonb;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select * into q from public.quotes where organization_id=org and id=quote and version=expected_version and status='sent' for update;
 if q.id is null then raise exception 'Conflicto de edición o estado';end if;
 if advance_due is null or balance_due is null or balance_due<advance_due then raise exception 'Fechas de cobro inválidas';end if;
 if q.valid_until<(now() at time zone (select timezone from public.organizations where id=org))::date then raise exception 'La propuesta venció; emite una nueva versión';end if;
 select * into v from public.quote_versions where organization_id=org and id=q.issued_version_id and state='issued';
 if v.id is null then raise exception 'Versión emitida no disponible';end if;
 select * into change from public.scope_changes where organization_id=org and quote_id=q.id;
 if change.id is not null then
  select id into strict project from public.projects where organization_id=org and id=change.project_id and client_id=q.client_id and deleted_at is null and state in ('active','paused') for update;
 else
 insert into public.projects(organization_id,client_id,quote_version_id,name,start_date) values(org,q.client_id,v.id,q.name,advance_due) returning id into project;
 end if;
 for line in select distinct (value->>'business_line_id')::uuid from jsonb_array_elements(v.snapshot->'items') loop
  select jsonb_agg(jsonb_build_object('name',value->>'name','description',value->>'description','quantity',value->>'quantity','unit',value->>'unit')),
   sum(round((value->>'quantity')::numeric*(value->>'unit_price_cents')::numeric/case when value->>'unit'='pct' then 100 else 1 end)-round(round((value->>'quantity')::numeric*(value->>'unit_price_cents')::numeric/case when value->>'unit'='pct' then 100 else 1 end)*(value->>'discount_rate')::numeric/100))::bigint
  into items,net from jsonb_array_elements(v.snapshot->'items') where (value->>'business_line_id')::uuid=line;
  insert into public.project_service_packages(organization_id,project_id,business_line_id,name,scope,scope_change_id) values(org,project,line,(select name from public.business_lines where id=line and organization_id=org),items,change.id) returning id into pkg;
  insert into public.package_financials(organization_id,package_id,contracted_net_cents) values(org,pkg,net);
 end loop;
 advance:=round(q.total_cents*q.advance_rate/100);
 if advance>0 then insert into public.payment_schedules(organization_id,project_id,label,amount_cents,due_date,scope_change_id) values(org,project,'Anticipo',advance,advance_due,change.id);end if;
 if q.total_cents-advance>0 then insert into public.payment_schedules(organization_id,project_id,label,amount_cents,due_date,scope_change_id) values(org,project,'Saldo',q.total_cents-advance,balance_due,change.id);end if;
 update public.quotes set status='accepted' where organization_id=org and id=quote;
 insert into public.quote_status_events(organization_id,quote_id,actor_id,status) values(org,quote,auth.uid(),'accepted');
 return project;
end $$;

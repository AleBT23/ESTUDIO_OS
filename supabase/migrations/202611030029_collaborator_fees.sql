alter table public.finance_cases add column package_id uuid,
 add foreign key(organization_id,project_id,package_id) references public.project_service_packages(organization_id,project_id,id),
 add check(package_id is null or project_id is not null);
grant insert(package_id) on public.finance_cases to authenticated;
alter table public.package_financials add column allocated_bps int not null default 0 check(allocated_bps between 0 and 10000);
create table public.collaborator_fees(
 id uuid primary key, organization_id uuid not null,project_id uuid not null,package_id uuid,member_id uuid not null,
 label text not null check(length(trim(label)) between 2 and 145),
 fixed_cents bigint check(fixed_cents between 1 and 99999999999999),
 rate_bps integer check(rate_bps between 1 and 10000),base_cents bigint,
 created_at timestamptz not null default now(),created_by uuid not null default auth.uid() references auth.users(id),
 check((fixed_cents is not null and rate_bps is null and base_cents is null) or (fixed_cents is null and rate_bps is not null and package_id is not null and base_cents>0)),
 foreign key(organization_id,project_id) references public.projects(organization_id,id),
 foreign key(organization_id,project_id,package_id) references public.project_service_packages(organization_id,project_id,id),
 foreign key(organization_id,member_id) references public.memberships(organization_id,user_id),
 foreign key(organization_id,id) references public.finance_cases(organization_id,id) deferrable initially deferred
);
create index fee_project on public.collaborator_fees(organization_id,project_id,created_at desc,id);
alter table public.collaborator_fees enable row level security;
revoke all on public.collaborator_fees from public,anon,authenticated;
grant select on public.collaborator_fees to authenticated;
grant insert(id,organization_id,project_id,package_id,member_id,label,fixed_cents,rate_bps) on public.collaborator_fees to authenticated;
create policy fee_admin on public.collaborator_fees for all to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[])) with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create function private.fee_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if new.rate_bps is not null then
 select contracted_net_cents into strict new.base_cents from public.package_financials where organization_id=new.organization_id and package_id=new.package_id;
 end if;
 return new;
end $$;
create function private.fee_commitment() returns trigger language plpgsql security definer set search_path='' as $$
declare customer uuid;amount bigint;
begin
 if not private.has_role(new.organization_id,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select client_id into strict customer from public.projects where organization_id=new.organization_id and id=new.project_id and deleted_at is null;
 if new.rate_bps is not null then
 update public.package_financials set allocated_bps=allocated_bps+new.rate_bps where organization_id=new.organization_id and package_id=new.package_id and allocated_bps+new.rate_bps<=10000
 returning round(new.base_cents::numeric*allocated_bps/10000)-round(new.base_cents::numeric*(allocated_bps-new.rate_bps)/10000) into amount;
 if not found then raise exception 'La distribución supera el 100 por ciento';end if;
 else amount:=new.fixed_cents;
 end if;
 insert into public.finance_cases(id,organization_id,client_id,project_id,package_id,name,area,revenue_cents,cost_cents)
 values(new.id,new.organization_id,customer,new.project_id,new.package_id,new.label,'architecture',0,amount);
 return new;
end $$;
revoke all on function private.fee_snapshot(),private.fee_commitment() from public,anon,authenticated;
create trigger fee_snapshot before insert on public.collaborator_fees for each row execute function private.fee_snapshot();
create trigger fee_commitment after insert on public.collaborator_fees for each row execute function private.fee_commitment();

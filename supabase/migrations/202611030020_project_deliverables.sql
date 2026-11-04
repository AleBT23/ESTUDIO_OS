create table public.project_deliverables(
 id uuid primary key,organization_id uuid not null,project_id uuid not null,
 stage text not null check(length(trim(stage)) between 1 and 120),
 name text not null check(length(trim(name)) between 2 and 200),due_on date not null,
 assignee uuid, created_by uuid not null default auth.uid() references auth.users(id),
 unique(organization_id,project_id,id),
 foreign key(organization_id,project_id) references public.projects(organization_id,id),
 foreign key(organization_id,assignee) references public.memberships(organization_id,user_id)
);
create index deliverables_due on public.project_deliverables(organization_id,project_id,due_on,id);
create table public.deliverable_revisions(
 id uuid primary key,organization_id uuid not null,project_id uuid not null,deliverable_id uuid not null,
 revision int not null check(revision>0),state text not null check(state in ('review','changes','approved')),
 notes text not null check(length(trim(notes)) between 1 and 4000),
 resource_url text check(length(resource_url)<=2000 and resource_url ~ '^https://[^[:space:]]+$'),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),unique(deliverable_id,revision),
 foreign key(organization_id,project_id,deliverable_id) references public.project_deliverables(organization_id,project_id,id)
);
do $$ declare tbl text;begin
 foreach tbl in array array['project_deliverables','deliverable_revisions'] loop
 execute format('alter table public.%I enable row level security',tbl);
 execute format('revoke all on public.%I from public,anon,authenticated',tbl);
 execute format('grant select on public.%I to authenticated',tbl);
 execute format('create policy production_read on public.%I for select to authenticated using(private.has_role(organization_id,array[''owner'',''admin'',''collaborator'',''reader'']::public.member_role[]))',tbl);
 execute format('create policy production_add on public.%I for insert to authenticated with check(private.has_role(organization_id,array[''owner'',''admin'',''collaborator'']::public.member_role[]) and exists(select 1 from public.projects p where p.organization_id=%I.organization_id and p.id=%I.project_id and p.deleted_at is null))',tbl,tbl,tbl);
 end loop;
end $$;
grant insert(id,organization_id,project_id,stage,name,due_on,assignee) on public.project_deliverables to authenticated;
grant insert(id,organization_id,project_id,deliverable_id,revision,state,notes,resource_url) on public.deliverable_revisions to authenticated;
create function private.check_deliverable_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare previous public.deliverable_revisions;
begin
 if not private.has_role(new.organization_id,array['owner','admin','collaborator']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 perform 1 from public.project_deliverables where organization_id=new.organization_id and project_id=new.project_id and id=new.deliverable_id for update;
 select * into previous from public.deliverable_revisions where organization_id=new.organization_id and deliverable_id=new.deliverable_id order by revision desc limit 1;
 if new.revision<>coalesce(previous.revision,0)+1 or previous.state='approved' then raise exception 'La revisión cambió o ya está aprobada';end if;
 if new.state in ('changes','approved') and (previous.state is distinct from 'review' or not private.has_role(new.organization_id,array['owner','admin']::public.member_role[])) then raise exception 'Solo administración revisa entregas enviadas';end if;
 return new;
end $$;
revoke all on function private.check_deliverable_revision() from public,anon,authenticated;
create trigger revision_guard before insert on public.deliverable_revisions for each row execute function private.check_deliverable_revision();
create view public.deliverable_status with(security_invoker=true) as
select d.*,coalesce(r.revision,0) revision,coalesce(r.state,'pending') state from public.project_deliverables d left join lateral(
 select revision,state from public.deliverable_revisions where organization_id=d.organization_id and deliverable_id=d.id order by revision desc limit 1
) r on true;
revoke all on public.deliverable_status from public,anon,authenticated;
grant select on public.deliverable_status to authenticated;

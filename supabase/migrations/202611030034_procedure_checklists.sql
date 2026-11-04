create function private.valid_procedure_steps(steps text[]) returns boolean
language sql immutable strict set search_path='' as $$
 select array_ndims(steps)=1 and array_lower(steps,1)=1 and cardinality(steps) between 1 and 100
 and not exists(select 1 from unnest(steps) step where step is null or length(trim(step)) not between 1 and 400)
$$;
create table public.studio_procedures (
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 name text not null check(length(trim(name)) between 2 and 160),
 steps text[] not null check(private.valid_procedure_steps(steps)),
 unique(organization_id,id)
);
create table public.procedure_runs (
 id uuid primary key, organization_id uuid not null, procedure_id uuid not null,
 name text not null check(length(trim(name)) between 2 and 160),
 project_id uuid, created_at timestamptz not null default now(),
 unique(organization_id,id),
 foreign key(organization_id,procedure_id) references public.studio_procedures(organization_id,id),
 foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create table public.procedure_checks (
 organization_id uuid not null, run_id uuid not null, step integer not null check(step>0),
 checked_at timestamptz not null default now(), checked_by uuid not null default auth.uid(),
 primary key(run_id,step), foreign key(organization_id,run_id) references public.procedure_runs(organization_id,id)
);
alter table public.studio_procedures enable row level security;
alter table public.procedure_runs enable row level security;
alter table public.procedure_checks enable row level security;
do $$ declare tbl text;begin
 foreach tbl in array array['studio_procedures','procedure_runs','procedure_checks'] loop
 execute format('revoke all on public.%I from public,anon,authenticated',tbl);
 execute format('grant select on public.%I to authenticated',tbl);
 execute format('create policy team_read on public.%I for select to authenticated using(private.has_role(organization_id,array[''owner'',''admin'',''collaborator'',''reader'']::public.member_role[]))',tbl);
 end loop;
end $$;
grant insert(id,organization_id,name,steps) on public.studio_procedures to authenticated;
create policy procedure_create on public.studio_procedures for insert to authenticated with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
grant insert(id,organization_id,procedure_id,name,project_id) on public.procedure_runs to authenticated;
create policy run_create on public.procedure_runs for insert to authenticated with check(private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[]));
grant insert(organization_id,run_id,step), delete on public.procedure_checks to authenticated;
create policy check_step on public.procedure_checks for insert to authenticated with check(
 private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[])
 and exists(select 1 from public.procedure_runs r join public.studio_procedures p on p.id=r.procedure_id
 where r.id=procedure_checks.run_id and procedure_checks.step<=cardinality(p.steps)));
create policy uncheck_step on public.procedure_checks for delete to authenticated using(private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[]));

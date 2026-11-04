alter table public.project_service_packages add unique(organization_id,project_id,id);
alter table public.project_notes add unique(organization_id,project_id,id);
create table public.project_time(
 id uuid primary key,organization_id uuid not null,project_id uuid not null,
 package_id uuid,task_id uuid,user_id uuid not null default auth.uid(),
 worked_on date not null,minutes integer not null check(minutes between 1 and 1440),
 description text not null check(length(trim(description)) between 1 and 1000),
 version integer not null default 1,created_at timestamptz not null default now(),
 foreign key(organization_id,project_id) references public.projects(organization_id,id),
 foreign key(organization_id,project_id,package_id) references public.project_service_packages(organization_id,project_id,id),
 foreign key(organization_id,project_id,task_id) references public.project_notes(organization_id,project_id,id),
 foreign key(organization_id,user_id) references public.memberships(organization_id,user_id)
);
create index project_time_date on public.project_time(organization_id,project_id,worked_on desc,id);
create table public.time_corrections(
 time_id uuid not null references public.project_time(id),version integer not null,
 corrected_at timestamptz not null default clock_timestamp(),actor_id uuid not null default auth.uid(),
 previous_values jsonb not null,primary key(time_id,version)
);
alter table public.project_time enable row level security;
alter table public.time_corrections enable row level security;
revoke all on public.project_time,public.time_corrections from public,anon,authenticated;
grant select on public.project_time,public.time_corrections to authenticated;
grant insert(id,organization_id,project_id,package_id,task_id,worked_on,minutes,description),update(package_id,task_id,worked_on,minutes,description) on public.project_time to authenticated;
create policy time_read on public.project_time for select to authenticated using(
 private.has_role(organization_id,array['owner','admin']::public.member_role[]) or
 (user_id=auth.uid() and private.has_role(organization_id,array['collaborator']::public.member_role[])));
create policy time_write on public.project_time for all to authenticated using(
 private.has_role(organization_id,array['owner','admin']::public.member_role[]) or
 (user_id=auth.uid() and private.has_role(organization_id,array['collaborator']::public.member_role[])))
 with check(private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[]) and
 (user_id=auth.uid() or private.has_role(organization_id,array['owner','admin']::public.member_role[])) and
 exists(select 1 from public.projects p where p.id=project_time.project_id and p.deleted_at is null)
 and (task_id is null or exists(select 1 from public.project_notes n where n.id=project_time.task_id and n.kind='task' and n.deleted_at is null))
 and (package_id is null or exists(select 1 from public.project_service_packages k where k.id=project_time.package_id and k.deleted_at is null)));
create policy correction_read on public.time_corrections for select to authenticated using(exists(select 1 from public.project_time t where t.id=time_id));
create function private.audit_time() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.time_corrections(time_id,version,previous_values) values(old.id,old.version,to_jsonb(old));
 new.version:=old.version+1;
 return new;
end $$;
revoke all on function private.audit_time() from public,anon,authenticated;
create trigger time_revision before update on public.project_time for each row execute function private.audit_time();
create policy manager_member_directory on public.memberships for select to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]));

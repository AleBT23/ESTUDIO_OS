alter table public.phase_templates add column tasks text[] not null default '{}'
check (cardinality(tasks)=0 or private.valid_procedure_steps(tasks));
grant insert(tasks),update(tasks) on public.phase_templates to authenticated;
alter table public.project_phase_plans add column tasks text[] not null default '{}';

create or replace function private.snapshot_project_phases() returns trigger
language plpgsql set search_path='' as $$
begin
  select t.name,t.phases,t.tasks into strict new.name,new.phases,new.tasks
  from public.phase_templates t where t.organization_id=new.organization_id
    and t.id=new.template_id and t.version=new.template_version;
  return new;
end $$;

create function private.copy_phase_tasks() returns trigger language plpgsql set search_path='' as $$
begin
  insert into public.project_notes(organization_id,project_id,kind,body)
  select new.organization_id,new.project_id,'task',task from unnest(new.tasks) task;
  return new;
end $$;
revoke all on function private.copy_phase_tasks() from public,anon,authenticated;
create trigger copy_phase_tasks after insert on public.project_phase_plans
for each row when (cardinality(new.tasks)>0) execute function private.copy_phase_tasks();

create table public.task_subtasks (
 id uuid primary key,organization_id uuid not null,task_id uuid not null,
 label text not null check(length(trim(label)) between 1 and 400),
 done boolean not null default false,created_at timestamptz not null default now(),
 foreign key(organization_id,task_id) references public.project_notes(organization_id,id)
);
create index subtasks_by_task on public.task_subtasks(organization_id,task_id,created_at,id);
alter table public.task_subtasks enable row level security;
revoke all on public.task_subtasks from public,anon,authenticated;
grant select,insert(id,organization_id,task_id,label),update(done) on public.task_subtasks to authenticated;
create policy subtasks_read on public.task_subtasks for select to authenticated using(exists(select 1 from public.project_notes_context n where n.id=task_id and n.organization_id=task_subtasks.organization_id and n.deleted_at is null));
create policy subtasks_write on public.task_subtasks for all to authenticated using(private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[]))
 with check(private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[]) and exists(select 1 from public.project_notes_context n where n.id=task_id and n.organization_id=task_subtasks.organization_id and n.deleted_at is null));
create function private.require_open_parent_task() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.project_notes where id=new.task_id and organization_id=new.organization_id and kind='task' and deleted_at is null and completed_at is null for update;
 if not found then raise exception 'Reabre la tarea antes de cambiar sus subtareas';end if;
 return new;
end $$;
create trigger open_parent_task before insert or update on public.task_subtasks for each row execute function private.require_open_parent_task();
create function private.check_subtask_completion() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.task_subtasks where organization_id=new.organization_id and task_id=new.id and not done) then
 raise exception 'Completa las subtareas pendientes antes de cerrar la tarea';end if;
 return new;
end $$;
create trigger complete_subtasks_first before update of completed_at on public.project_notes for each row
 when(new.completed_at is not null and old.completed_at is null) execute function private.check_subtask_completion();
create function private.copy_recurring_subtasks() returns trigger language plpgsql set search_path='' as $$
begin
 insert into public.task_subtasks(id,organization_id,task_id,label)
 select gen_random_uuid(),new.organization_id,new.id,label from public.task_subtasks where organization_id=new.organization_id and task_id=new.previous_occurrence;
 return new;
end $$;
create trigger copy_task_steps after insert on public.project_notes for each row when(new.previous_occurrence is not null) execute function private.copy_recurring_subtasks();

alter table public.project_notes
 add column priority text not null default 'normal' check(priority in ('low','normal','high')),
 add column repeat_days smallint not null default 0 check(repeat_days in (0,1,7,14)),
 add column assignee uuid,
 add column previous_occurrence uuid unique references public.project_notes(id),
 add foreign key(organization_id,assignee) references public.memberships(organization_id,user_id),
 add check(repeat_days=0 or (kind='task' and due_on is not null));
grant insert(priority,repeat_days,assignee),update(priority,repeat_days,assignee) on public.project_notes to authenticated;
create index notes_assignee_due on public.project_notes(organization_id,assignee,due_on) where completed_at is null and deleted_at is null;
create or replace view public.project_notes_context with(security_invoker=true) as
select n.id,n.organization_id,n.project_id,n.kind,n.body,n.due_on,n.completed_at,n.created_by,n.version,n.created_at,n.updated_at,n.deleted_at,p.name project_name,
n.priority,n.repeat_days,n.assignee from public.project_notes n join public.projects p on p.organization_id=n.organization_id and p.id=n.project_id where p.deleted_at is null;
create function private.next_project_task() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.project_notes(organization_id,project_id,kind,body,due_on,priority,assignee,repeat_days,previous_occurrence)
 values(new.organization_id,new.project_id,'task',new.body,new.due_on+new.repeat_days::integer,new.priority,new.assignee,new.repeat_days,new.id)
 on conflict(previous_occurrence) do nothing;
 return new;
end $$;
revoke all on function private.next_project_task() from public,anon,authenticated;
create trigger schedule_next_task after update of completed_at on public.project_notes for each row
when(old.completed_at is null and new.completed_at is not null and new.repeat_days>0 and new.deleted_at is null)
execute function private.next_project_task();

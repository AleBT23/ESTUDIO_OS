alter table public.project_notes add column in_progress boolean not null default false
 check(not in_progress or kind='task');
grant update(in_progress) on public.project_notes to authenticated;
create view public.project_task_board with(security_invoker=true) as
 select n.organization_id,n.id,n.project_id,p.name project_name,n.body,n.due_on,n.priority,n.assignee,n.version,
 case when n.completed_at is not null then 'done' when n.in_progress then 'working' else 'pending' end lane
 from public.project_notes n join public.projects p on p.id=n.project_id and p.organization_id=n.organization_id
 where n.kind='task' and n.deleted_at is null and p.deleted_at is null;
revoke all on public.project_task_board from public,anon,authenticated;
grant select on public.project_task_board to authenticated;

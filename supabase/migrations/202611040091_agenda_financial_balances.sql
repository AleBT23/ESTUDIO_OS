create or replace view public.agenda_events with(security_invoker=true) as
select organization_id,id,project_id,'task'::text kind,body label,due_on,null::text balance_cents,null::boolean managed
from public.project_notes_context where kind='task' and deleted_at is null and completed_at is null and due_on is not null
union all
select organization_id,id,project_id,case when source='schedule' then 'collection'
  when direction='in' then 'agreement_collection' else 'agreement_payment' end,label,due_on,balance_cents,managed
from public.open_obligations where due_on is not null
union all
select d.organization_id,d.id,d.project_id,'delivery',d.name,d.due_on,null,null
from public.deliverable_status d join public.projects p on p.organization_id=d.organization_id and p.id=d.project_id
where d.state<>'approved' and p.deleted_at is null
union all
select organization_id,id,null,'follow_up',name,next_follow_up,null,null
from public.opportunities where deleted_at is null and stage not in ('won','lost') and next_follow_up is not null
union all
select organization_id,id,project_id,'publication',title,publication_on,null,null
from public.editorial_items where status='scheduled'
union all
select organization_id,id,null,'personal',label,due_on,null,null from public.personal_reminders where not completed
union all
select organization_id,id,id,'project_end',name,target_end,null,null from public.projects
where target_end is not null and deleted_at is null and state in ('active','paused');

create or replace view public.agenda_notifications with(security_invoker=true) as
select e.organization_id,e.id,e.project_id,e.kind,e.label,e.due_on,r.read_at,e.balance_cents,e.managed
from public.agenda_events e join public.organizations o on o.id=e.organization_id
left join public.agenda_notification_reads r on r.organization_id=e.organization_id and r.user_id=auth.uid()
and r.kind=e.kind and r.event_id=e.id and r.due_on=e.due_on
where e.due_on<=(now() at time zone o.timezone)::date;

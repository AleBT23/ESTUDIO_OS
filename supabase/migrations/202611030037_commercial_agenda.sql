create or replace view public.agenda_events with(security_invoker=true) as
select organization_id,id,project_id,'task'::text kind,body label,due_on
from public.project_notes_context where kind='task' and deleted_at is null and completed_at is null and due_on is not null
union all
select organization_id,id,project_id,'collection',label,due_date from public.payment_schedule_balances where balance_cents>0
union all
select d.organization_id,d.id,d.project_id,'delivery',d.name,d.due_on
from public.deliverable_status d join public.projects p on p.organization_id=d.organization_id and p.id=d.project_id
where d.state<>'approved' and p.deleted_at is null

union all
select organization_id,id,null::uuid,'follow_up',name,next_follow_up
from public.opportunities where deleted_at is null and stage not in ('won','lost') and next_follow_up is not null
union all
select organization_id,id,project_id,'publication',title,publication_on
from public.editorial_items where status='scheduled';

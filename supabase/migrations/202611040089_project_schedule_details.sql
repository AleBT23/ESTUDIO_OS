create view public.project_schedule_details with(security_invoker=true) as
select b.*, s.scope_change_id, s.cancelled_cents, c.description change_description
from public.payment_schedule_balances b
join public.payment_schedules s on s.organization_id=b.organization_id and s.id=b.id
left join public.scope_changes c on c.organization_id=s.organization_id and c.id=s.scope_change_id;
revoke all on public.project_schedule_details from public,anon,authenticated;
grant select on public.project_schedule_details to authenticated;

create index schedules_by_scope_change on public.payment_schedules(organization_id,scope_change_id) where scope_change_id is not null;
create view public.scope_change_statement with(security_invoker=true) as
select c.id,c.organization_id,c.project_id,c.created_at,c.description,c.days_impact,c.quote_id,
  q.name quote_name,q.status quote_status,q.deleted_at quote_deleted_at,q.total_cents::text quote_total,
  totals.scheduled,totals.received,totals.outstanding,totals.cancelled
from public.scope_changes c
left join public.quotes q on q.organization_id=c.organization_id and q.id=c.quote_id
left join lateral (
  select sum(s.amount_cents)::text scheduled,sum(b.collected_cents)::text received,
    sum(b.balance_cents)::text outstanding,sum(s.cancelled_cents)::text cancelled
  from public.payment_schedules s
  join public.payment_schedule_balances b on b.organization_id=s.organization_id and b.id=s.id
  where s.organization_id=c.organization_id and s.scope_change_id=c.id
) totals on true;
revoke all on public.scope_change_statement from public,anon,authenticated;
grant select on public.scope_change_statement to authenticated;

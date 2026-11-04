create index finance_case_work on public.finance_cases(organization_id,work_id) where work_id is not null;
create view public.work_balances with(security_invoker=true) as
select organization_id, work_id, managed,
 sum(revenue_cents)::text revenue_cents, sum(cost_cents)::text cost_cents,
 sum(received_cents)::text received_cents, sum(paid_cents)::text paid_cents,
 sum(receivable_cents)::text receivable_cents, sum(payable_cents)::text payable_cents,
 sum(cash_cents)::text cash_cents, sum(expected_margin_cents)::text expected_margin_cents
from public.finance_case_balances where work_id is not null
group by organization_id,work_id,managed;
revoke all on public.work_balances from public,anon,authenticated;
grant select on public.work_balances to authenticated;

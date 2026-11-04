-- Plans converted from quotations have no reliable historical cost basis.
-- Present them separately and leave their margin unknown.
create view public.finance_area_indicators with(security_invoker=true) as
select organization_id,area,managed,'operations'::text source,
 sum(received_cents)::text received_cents,sum(paid_cents)::text paid_cents,
 sum(receivable_cents)::text receivable_cents,sum(payable_cents)::text payable_cents,
 sum(expected_margin_cents)::text expected_margin_cents,sum(cash_cents)::text cash_cents
from public.finance_case_balances group by organization_id,area,managed
union all
select organization_id,'architecture',false,'schedules',
 sum(collected_cents)::text,null,sum(balance_cents)::text,null,null,null
from public.payment_schedule_balances group by organization_id;
revoke all on public.finance_area_indicators from public,anon,authenticated;
grant select on public.finance_area_indicators to authenticated;

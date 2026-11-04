create view public.work_item_progress with(security_invoker=true) as
select organization_id,work_id,id,chapter,description,unit,quantity::text quantity,
 estimated_quantity::text measured,(quantity-estimated_quantity)::text remaining,
 unit_price_cents::text price,total_cents::text budget,
 round(estimated_quantity*unit_price_cents)::text earned,
 (total_cents-round(estimated_quantity*unit_price_cents))::text outstanding
from public.work_budget_items;
revoke all on public.work_item_progress from public,anon,authenticated;
grant select on public.work_item_progress to authenticated;

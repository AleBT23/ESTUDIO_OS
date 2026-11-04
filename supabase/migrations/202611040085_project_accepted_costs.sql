create or replace view public.project_quote_estimates with(security_invoker=true) as
with accepted as (
  select p.organization_id,p.id project_id,p.quote_version_id version_id
  from public.projects p where p.deleted_at is null and p.quote_version_id is not null
  union
  select c.organization_id,c.project_id,q.issued_version_id from public.scope_changes c
  join public.projects p on p.organization_id=c.organization_id and p.id=c.project_id
  join public.quotes q on q.organization_id=c.organization_id and q.id=c.quote_id
  where p.deleted_at is null and q.status='accepted'
), basis as (
  select a.organization_id,a.project_id,
    coalesce((v.internal_estimate->>'revenue')::numeric,q.subtotal_cents-q.discount_cents) net,
    coalesce((v.internal_estimate->>'direct')::numeric,q.direct_cost_cents) direct,
    coalesce((v.internal_estimate->>'external')::numeric,q.external_cost_cents) external_cost,
    case when v.internal_estimate is null then round(q.estimated_hours*q.hourly_cost_cents)
      else (v.internal_estimate->>'labor')::numeric end labor,
    coalesce((v.internal_estimate->>'hours')::numeric,q.estimated_hours) hours,
    v.internal_estimate is null historical
  from accepted a join public.quote_versions v on v.organization_id=a.organization_id and v.id=a.version_id
  join public.quotes q on q.id=v.quote_id and q.organization_id=a.organization_id
  where q.status='accepted' and private.has_role(a.organization_id,array['owner','admin']::public.member_role[])
), totals as (
  select organization_id,project_id,count(*) quote_count,sum(net) net,sum(external_cost) external_cost,
    sum(direct) direct,sum(hours) hours,sum(coalesce(labor,0)) labor,
    coalesce(sum(hours) filter(where labor is null),0) unrated_hours,
    count(*) filter(where historical) historical_quotes from basis group by organization_id,project_id
), results as (
  select totals.*,net-external_cost-direct-labor profit from totals
)
select organization_id,project_id,quote_count,net::text net_cents,external_cost::text external_cost_cents,
  profit::text expected_profit_cents,round(profit*100/nullif(net,0),2)::text margin_percent,
  hours::text estimated_hours,round(net/nullif(hours,0))::text estimated_hourly_cents,
  direct::text direct_cost_cents,labor::text labor_cost_cents,unrated_hours::text unrated_hours,historical_quotes
from results;

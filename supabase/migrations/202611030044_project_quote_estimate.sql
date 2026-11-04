create view public.project_quote_estimates with(security_invoker=true) as
with accepted as (
 select p.organization_id,p.id project_id,v.quote_id from public.projects p
 join public.quote_versions v on v.organization_id=p.organization_id and v.id=p.quote_version_id where p.deleted_at is null
 union
 select c.organization_id,c.project_id,c.quote_id from public.scope_changes c
 join public.projects p on p.organization_id=c.organization_id and p.id=c.project_id where p.deleted_at is null
), estimates as (
 select a.organization_id,a.project_id,count(*) quote_count,
 sum(q.subtotal_cents-q.discount_cents) net,sum(q.external_cost_cents) external_cost,sum(q.estimated_hours) hours
 from accepted a join public.quotes q on q.organization_id=a.organization_id and q.id=a.quote_id
 where q.status='accepted' and private.has_role(a.organization_id,array['owner','admin']::public.member_role[])
 group by a.organization_id,a.project_id
)
select organization_id,project_id,quote_count,net::text net_cents,external_cost::text external_cost_cents,
 (net-external_cost)::text expected_profit_cents,round((net-external_cost)*100/nullif(net,0),2)::text margin_percent,
 hours::text estimated_hours,round(net/nullif(hours,0))::text estimated_hourly_cents from estimates;
revoke all on public.project_quote_estimates from public,anon,authenticated;
grant select on public.project_quote_estimates to authenticated;

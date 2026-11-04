create view public.client_agreements with(security_invoker=true) as
select c.organization_id,coalesce(c.client_id,p.client_id,w.client_id,wp.client_id) client_id,
 c.id,c.name,c.area,c.managed,c.created_at,
 c.receivable_cents::text receivable,c.payable_cents::text payable
from public.finance_case_balances c
left join public.projects p on p.organization_id=c.organization_id and p.id=c.project_id
left join public.works w on w.organization_id=c.organization_id and w.id=c.work_id
left join public.projects wp on wp.organization_id=w.organization_id and wp.id=w.project_id;
revoke all on public.client_agreements from public,anon,authenticated;
grant select on public.client_agreements to authenticated;

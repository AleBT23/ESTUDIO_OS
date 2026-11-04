create view public.supplier_agreements with(security_invoker=true) as
select a.organization_id,a.supplier_id,b.id,b.name,b.managed,b.created_at,
 b.cost_cents,b.paid_cents,b.payable_cents
from public.finance_cases a
join public.finance_case_balances b on b.organization_id=a.organization_id and b.id=a.id
where a.supplier_id is not null;
create view public.supplier_totals with(security_invoker=true) as
select organization_id,supplier_id,managed,sum(cost_cents)::text cost,sum(paid_cents)::text paid,
 sum(payable_cents)::text payable from public.supplier_agreements group by organization_id,supplier_id,managed;
revoke all on public.supplier_agreements,public.supplier_totals from public,anon,authenticated;
grant select on public.supplier_agreements,public.supplier_totals to authenticated;
create or replace view public.searchable_records with(security_invoker=true) as
select organization_id,'projects'::text source,id,name label from public.projects where deleted_at is null
union all select organization_id,'clients',id,name from public.clients where deleted_at is null
union all select organization_id,'quotes',id,name from public.quotes where deleted_at is null
union all select organization_id,'studio_documents',id,title from public.studio_documents where deleted_at is null
union all select organization_id,'works',id,name from public.works where private.has_role(organization_id,array['owner','admin']::public.member_role[])
union all select organization_id,'finance_cases',id,name from public.finance_cases
union all select organization_id,'opportunities',id,name from public.opportunities where deleted_at is null
union all select organization_id,'editorial_items',id,title from public.editorial_items
union all select organization_id,'library',resource_id,title from public.current_library_resources
union all select organization_id,'suppliers',id,name from public.suppliers
union all select organization_id,'personal_reminders',id,label from public.personal_reminders where not completed;

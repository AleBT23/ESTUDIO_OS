create view public.open_obligations with(security_invoker=true) as
with pending as (
 select b.organization_id,b.id,'agreement'::text source,b.name label,b.area,b.managed,
 coalesce(c.project_id,w.project_id) project_id,c.work_id,coalesce(c.client_id,p.client_id,w.client_id,wp.client_id) client_id,
 d.direction,d.due_on,d.balance
 from public.finance_case_balances b join public.finance_cases c on c.organization_id=b.organization_id and c.id=b.id
 left join public.projects p on p.organization_id=c.organization_id and p.id=c.project_id
 left join public.works w on w.organization_id=c.organization_id and w.id=c.work_id
 left join public.projects wp on wp.organization_id=w.organization_id and wp.id=w.project_id
 cross join lateral (values ('in',c.collect_on,b.receivable_cents),('out',c.pay_on,b.payable_cents)) d(direction,due_on,balance)
 where d.balance>0
 union all
 select b.organization_id,b.id,'schedule',p.name||' · '||b.label,'project_plan',false,
 p.id,null,p.client_id,'in',b.due_date,b.balance_cents
 from public.payment_schedule_balances b join public.projects p on p.organization_id=b.organization_id and p.id=b.project_id
 where b.balance_cents>0
), dated as (
 select p.*,((now() at time zone o.timezone)::date-p.due_on) days_late
 from pending p join public.organizations o on o.id=p.organization_id
 where private.has_role(p.organization_id,array['owner','admin']::public.member_role[])
)
select organization_id,id,source,label,area,managed,project_id,work_id,client_id,direction,due_on,balance::text balance_cents,days_late,
 case when days_late is null then 'undated' when days_late<0 then 'upcoming' when days_late=0 then 'today'
 when days_late<=30 then 'late_30' when days_late<=60 then 'late_60' else 'late_over_60' end age_group
from dated;
revoke all on public.open_obligations from public,anon,authenticated;
grant select on public.open_obligations to authenticated;

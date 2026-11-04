create function public.area_cash_report(org uuid,from_date date default null,to_date date default null,
 customer uuid default null,project uuid default null,work uuid default null,package uuid default null,line uuid default null)
returns table(area text,managed boolean,received text,paid text,net text)
language sql stable security invoker set search_path='' as $$
with events as (
 select c.area,c.managed,e.paid_on,coalesce(c.client_id,p.client_id,w.client_id,wp.client_id) client_id,
 coalesce(c.project_id,w.project_id) project_id,c.work_id,c.package_id,k.business_line_id,
 case when e.direction='in' then e.amount_cents else 0 end received,
 case when e.direction='out' then e.amount_cents else 0 end paid
 from public.finance_entries e
 join public.finance_cases c on c.organization_id=e.organization_id and c.id=e.case_id
 left join public.projects p on p.organization_id=c.organization_id and p.id=c.project_id
 left join public.works w on w.organization_id=c.organization_id and w.id=c.work_id
 left join public.projects wp on wp.organization_id=w.organization_id and wp.id=w.project_id
 left join public.project_service_packages k on k.organization_id=c.organization_id and k.id=c.package_id
 where e.organization_id=org and e.reversed_at is null
 union all
 select 'project_plan',false,e.paid_on,p.client_id,p.id,null,null,null,e.amount_cents,0
 from public.payments e join public.payment_schedules s on s.organization_id=e.organization_id and s.id=e.schedule_id
 join public.projects p on p.organization_id=s.organization_id and p.id=s.project_id
 where e.organization_id=org and e.state='posted' and e.deleted_at is null
)
select e.area,e.managed,sum(e.received)::text,sum(e.paid)::text,(sum(e.received)-sum(e.paid))::text
from events e where private.has_role(org,array['owner','admin']::public.member_role[])
 and (from_date is null or e.paid_on>=from_date) and (to_date is null or e.paid_on<=to_date)
 and (customer is null or e.client_id=customer) and (project is null or e.project_id=project)
 and (work is null or e.work_id=work) and (package is null or e.package_id=package)
 and (line is null or e.business_line_id=line)
group by e.area,e.managed order by e.area,e.managed;
$$;
revoke all on function public.area_cash_report(uuid,date,date,uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.area_cash_report(uuid,date,date,uuid,uuid,uuid,uuid,uuid) to authenticated;

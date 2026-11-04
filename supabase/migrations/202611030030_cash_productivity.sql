create function public.cash_productivity(org uuid,from_date date default null,to_date date default null,customer uuid default null,project uuid default null,work uuid default null,package uuid default null,line uuid default null)
returns table(line_id uuid,line_name text,managed boolean,received text,paid text,net text,minutes text,net_hourly text)
language sql stable security invoker set search_path='' as $$
 with events as (
 select c.organization_id,coalesce(c.client_id,p.client_id,w.client_id) client_id,c.project_id,c.work_id,c.package_id,c.managed,e.paid_on as event_date,
 case when e.direction='in' then e.amount_cents else 0 end received,case when e.direction='out' then e.amount_cents else 0 end paid,0 minutes
 from public.finance_entries e join public.finance_cases c on c.organization_id=e.organization_id and c.id=e.case_id
 left join public.projects p on p.organization_id=c.organization_id and p.id=c.project_id
 left join public.works w on w.organization_id=c.organization_id and w.id=c.work_id
 where e.organization_id=org and e.reversed_at is null
 union all
 select s.organization_id,p.client_id,s.project_id,null,null,false,e.paid_on,e.amount_cents,0,0
 from public.payments e join public.payment_schedules s on s.organization_id=e.organization_id and s.id=e.schedule_id
 join public.projects p on p.organization_id=s.organization_id and p.id=s.project_id
 where e.organization_id=org and e.state='posted' and e.deleted_at is null
 union all
 select t.organization_id,p.client_id,t.project_id,null,t.package_id,false,t.worked_on,0,0,t.minutes
 from public.project_time t join public.projects p on p.organization_id=t.organization_id and p.id=t.project_id where t.organization_id=org
 ),totals as (
 select k.business_line_id,e.managed,sum(e.received) r,sum(e.paid) p,sum(e.minutes) m
 from events e left join public.project_service_packages k on k.organization_id=e.organization_id and k.id=e.package_id
 where private.has_role(org,array['owner','admin']::public.member_role[])
 and (from_date is null or e.event_date>=from_date) and (to_date is null or e.event_date<=to_date)
 and (customer is null or e.client_id=customer) and (project is null or e.project_id=project)
 and (work is null or e.work_id=work) and (package is null or e.package_id=package)
 and (line is null or k.business_line_id=line)
 group by k.business_line_id,e.managed
 )
 select t.business_line_id,coalesce(l.name,'Sin línea atribuida'),t.managed,t.r::text,t.p::text,(t.r-t.p)::text,t.m::text,
 case when not t.managed and t.m>0 then round((t.r-t.p)*60::numeric/t.m)::text end
 from totals t left join public.business_lines l on l.organization_id=org and l.id=t.business_line_id
 order by t.managed,l.name nulls last,t.business_line_id;
$$;
revoke all on function public.cash_productivity(uuid,date,date,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.cash_productivity(uuid,date,date,uuid,uuid,uuid,uuid,uuid) to authenticated;

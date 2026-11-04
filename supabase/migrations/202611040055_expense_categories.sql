alter table public.finance_entries add column expense_category text
 check (expense_category is null or (direction='out' and expense_category in
 ('material','labor','equipment','external','permit','overhead','other')));
grant insert(expense_category) on public.finance_entries to authenticated;

create function public.expense_breakdown(org uuid,from_date date default null,to_date date default null,
 customer uuid default null,project uuid default null,work uuid default null,package uuid default null,line uuid default null)
returns table(area text,managed boolean,category text,movements bigint,paid text)
language sql stable security invoker set search_path='' as $$
 select c.area,c.managed,e.expense_category,count(*),sum(e.amount_cents)::text
 from public.finance_entries e
 join public.finance_cases c on c.organization_id=e.organization_id and c.id=e.case_id
 left join public.projects p on p.organization_id=c.organization_id and p.id=c.project_id
 left join public.works w on w.organization_id=c.organization_id and w.id=c.work_id
 left join public.projects wp on wp.organization_id=w.organization_id and wp.id=w.project_id
 left join public.project_service_packages k on k.organization_id=c.organization_id and k.id=c.package_id
 where e.organization_id=org and e.direction='out' and e.reversed_at is null
 and private.has_role(org,array['owner','admin']::public.member_role[])
 and (from_date is null or e.paid_on>=from_date) and (to_date is null or e.paid_on<=to_date)
 and (customer is null or coalesce(c.client_id,p.client_id,w.client_id,wp.client_id)=customer)
 and (project is null or coalesce(c.project_id,w.project_id)=project)
 and (work is null or c.work_id=work) and (package is null or c.package_id=package)
 and (line is null or k.business_line_id=line)
 group by c.area,c.managed,e.expense_category order by c.area,c.managed,e.expense_category;
$$;
revoke all on function public.expense_breakdown(uuid,date,date,uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.expense_breakdown(uuid,date,date,uuid,uuid,uuid,uuid,uuid) to authenticated;

create function public.project_package_execution(org uuid, project uuid)
returns table(package_id uuid, package_name text, contracted text, received text, paid text,
  managed_received text, managed_paid text, minutes text)
language sql stable security invoker set search_path='' as $$
  with events(package_id,contracted,received,paid,managed_received,managed_paid,minutes) as (
    select k.id,f.contracted_net_cents,0,0,0,0,0
    from public.project_service_packages k left join public.package_financials f
      on f.organization_id=k.organization_id and f.package_id=k.id
    where k.organization_id=org and k.project_id=project and k.deleted_at is null
    union all
    select c.package_id,null,
      case when not c.managed and e.direction='in' then e.amount_cents else 0 end,
      case when not c.managed and e.direction='out' then e.amount_cents else 0 end,
      case when c.managed and e.direction='in' then e.amount_cents else 0 end,
      case when c.managed and e.direction='out' then e.amount_cents else 0 end,0
    from public.finance_entries e join public.finance_cases c on c.organization_id=e.organization_id and c.id=e.case_id
    left join public.works w on w.organization_id=c.organization_id and w.id=c.work_id
    where e.organization_id=org and coalesce(c.project_id,w.project_id)=project and e.reversed_at is null
    union all
    select null,null,e.amount_cents,0,0,0,0 from public.payments e
    join public.payment_schedules s on s.organization_id=e.organization_id and s.id=e.schedule_id
    where e.organization_id=org and s.project_id=project and e.state='posted' and e.deleted_at is null
    union all
    select t.package_id,null,0,0,0,0,t.minutes from public.project_time t
    where t.organization_id=org and t.project_id=project
  )
  select e.package_id,coalesce(k.name,'Sin paquete asignado'),max(e.contracted)::text,
    sum(e.received)::text,sum(e.paid)::text,sum(e.managed_received)::text,sum(e.managed_paid)::text,sum(e.minutes)::text
  from events e left join public.project_service_packages k on k.organization_id=org and k.id=e.package_id
  where private.has_role(org,array['owner','admin']::public.member_role[])
  group by e.package_id,k.name order by k.name nulls last,e.package_id;
$$;
revoke all on function public.project_package_execution(uuid,uuid) from public,anon;
grant execute on function public.project_package_execution(uuid,uuid) to authenticated;

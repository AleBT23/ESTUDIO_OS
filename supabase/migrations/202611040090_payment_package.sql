alter table public.payments add column package_id uuid,
  add foreign key(organization_id,package_id) references public.project_service_packages(organization_id,id);

create function public.record_package_payment(org uuid,schedule uuid,amount bigint,payment_date date,payment_reference text,request_id uuid, target_package uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare due public.payment_schedules;collected bigint;target uuid;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select * into due from public.payment_schedules where organization_id=org and id=schedule for update;
 if due.id is null then raise exception 'Plan no disponible';end if;
 select id into target from public.payments where organization_id=org and idempotency_key=request_id;
 if target is not null then
  if not exists(select 1 from public.payments where id=target and schedule_id=schedule and amount_cents=amount and paid_on=payment_date and reference=payment_reference and package_id is not distinct from target_package) then raise exception 'La clave de operación corresponde a otro movimiento';end if;
  return target;
 end if;
 if target_package is not null and not exists(
   select 1 from public.project_service_packages k where k.organization_id=org and k.project_id=due.project_id
   and k.id=target_package and k.scope_change_id is not distinct from due.scope_change_id and k.deleted_at is null
 ) then raise exception 'El paquete no pertenece al alcance de esta obligación';end if;
 if payment_date is null or payment_date>(now() at time zone (select timezone from public.organizations where id=org))::date then raise exception 'Fecha de pago inválida';end if;
 select coalesce(sum(amount_cents),0) into collected from public.payments where organization_id=org and schedule_id=schedule and state='posted';
 if amount<=0 or amount>due.amount_cents-collected then raise exception 'El importe supera el saldo pendiente o no es positivo';end if;
 insert into public.payments(organization_id,schedule_id,amount_cents,paid_on,reference,idempotency_key,package_id) values(org,schedule,amount,payment_date,payment_reference,request_id,target_package) returning id into target;
 return target;
end $$;
revoke all on function public.record_package_payment(uuid,uuid,bigint,date,text,uuid,uuid) from public,anon;
grant execute on function public.record_package_payment(uuid,uuid,bigint,date,text,uuid,uuid) to authenticated;
create or replace function public.record_payment(org uuid,schedule uuid,amount bigint,payment_date date,payment_reference text,request_id uuid) returns uuid
language sql security invoker set search_path='' as $$
 select public.record_package_payment(org,schedule,amount,payment_date,payment_reference,request_id,null);
$$;

create or replace function public.cash_productivity(org uuid,from_date date default null,to_date date default null,customer uuid default null,project uuid default null,work uuid default null,package uuid default null,line uuid default null)
returns table(line_id uuid,line_name text,managed boolean,received text,paid text,net text,minutes text,net_hourly text)
language sql stable security invoker set search_path='' as $$
 with events as (
 select c.organization_id,coalesce(c.client_id,p.client_id,w.client_id,wp.client_id) client_id,coalesce(c.project_id,w.project_id) project_id,c.work_id,c.package_id,c.managed,e.paid_on as event_date,
 case when e.direction='in' then e.amount_cents else 0 end received,case when e.direction='out' then e.amount_cents else 0 end paid,0 minutes
 from public.finance_entries e join public.finance_cases c on c.organization_id=e.organization_id and c.id=e.case_id
 left join public.projects p on p.organization_id=c.organization_id and p.id=c.project_id
 left join public.works w on w.organization_id=c.organization_id and w.id=c.work_id
 left join public.projects wp on wp.organization_id=w.organization_id and wp.id=w.project_id
 where e.organization_id=org and e.reversed_at is null
 union all
 select s.organization_id,p.client_id,s.project_id,null,e.package_id,false,e.paid_on,e.amount_cents,0,0
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

create or replace function public.area_cash_report(org uuid,from_date date default null,to_date date default null,
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
 select 'project_plan',false,e.paid_on,p.client_id,p.id,null,e.package_id,k.business_line_id,e.amount_cents,0
 from public.payments e join public.payment_schedules s on s.organization_id=e.organization_id and s.id=e.schedule_id
 join public.projects p on p.organization_id=s.organization_id and p.id=s.project_id
 left join public.project_service_packages k on k.organization_id=e.organization_id and k.id=e.package_id
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

-- Una sola instantánea por archivo, incluidos los reversos identificados como tales.
create or replace function public.cash_ledger_export(org uuid,from_date date default null,to_date date default null,
 customer uuid default null,project uuid default null,work uuid default null,package uuid default null,line uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare report jsonb;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes' using errcode='42501';end if;
 if from_date>to_date then raise exception 'Intervalo inválido' using errcode='22007';end if;
 with metadata as (
   select 'acuerdo' source,e.id,c.area,coalesce(c.client_id,p.client_id,w.client_id,wp.client_id) client_id,
   coalesce(c.project_id,w.project_id) project_id,c.work_id,c.package_id,k.business_line_id,
   e.expense_category,coalesce(sp.name,c.provider) supplier,e.reversed_at
   from public.finance_entries e join public.finance_cases c on c.organization_id=e.organization_id and c.id=e.case_id
   left join public.projects p on p.organization_id=c.organization_id and p.id=c.project_id
   left join public.works w on w.organization_id=c.organization_id and w.id=c.work_id
   left join public.projects wp on wp.organization_id=w.organization_id and wp.id=w.project_id
   left join public.project_service_packages k on k.organization_id=c.organization_id and k.id=c.package_id
   left join public.suppliers sp on sp.organization_id=c.organization_id and sp.id=c.supplier_id
   where e.organization_id=org
   union all
   select 'proyecto',e.id,'project_plan',p.client_id,p.id,null,e.package_id,k.business_line_id,null,null,e.reversed_at
   from public.payments e join public.payment_schedules s on s.organization_id=e.organization_id and s.id=e.schedule_id
   join public.projects p on p.organization_id=s.organization_id and p.id=s.project_id
 left join public.project_service_packages k on k.organization_id=e.organization_id and k.id=e.package_id where e.organization_id=org and e.deleted_at is null
 ), limited as (
 select r.id,r.source,r.paid_on,r.concept,r.client_name,r.project_name,r.work_name,m.supplier,
 m.area,r.managed,r.direction,r.amount,r.reference,m.expense_category,r.reversed,m.reversed_at,r.reversal_reason,k.name package_name,l.name line_name
 from public.movement_receipts r join metadata m on m.source=r.source and m.id=r.id
 left join public.project_service_packages k on k.organization_id=r.organization_id and k.id=m.package_id
 left join public.business_lines l on l.organization_id=r.organization_id and l.id=m.business_line_id
 where r.organization_id=org and (from_date is null or r.paid_on>=from_date) and (to_date is null or r.paid_on<=to_date)
 and (customer is null or customer=m.client_id) and (project is null or project=m.project_id)
 and (work is null or work=m.work_id) and (package is null or package=m.package_id) and (line is null or line=m.business_line_id)
 order by r.paid_on,r.source,r.id limit 5001
 )
 select coalesce(jsonb_agg(to_jsonb(t) order by t.paid_on,t.source,t.id),'[]'::jsonb) into report from limited t;
 if jsonb_array_length(report)>5000 then raise exception 'Acota los filtros a 5000 movimientos por archivo' using errcode='54000';end if;
 return report;
end $$;
revoke all on function public.cash_ledger_export(uuid,date,date,uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.cash_ledger_export(uuid,date,date,uuid,uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.project_package_execution(org uuid, project uuid)
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
    select e.package_id,null,e.amount_cents,0,0,0,0 from public.payments e
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

create function public.schedule_package_options(org uuid,schedules uuid[])
returns table(schedule_id uuid,options jsonb)
language sql stable security invoker set search_path='' as $$
 select s.id,jsonb_agg(jsonb_build_object('id',k.id,'name',k.name) order by k.name,k.id)
 from public.payment_schedules s join public.project_service_packages k
 on k.organization_id=s.organization_id and k.project_id=s.project_id
 and k.scope_change_id is not distinct from s.scope_change_id and k.deleted_at is null
 where s.organization_id=org and s.id=any(schedules)
 and private.has_role(org,array['owner','admin']::public.member_role[])
 group by s.id;
$$;
revoke all on function public.schedule_package_options(uuid,uuid[]) from public,anon;
grant execute on function public.schedule_package_options(uuid,uuid[]) to authenticated;

create view public.project_payment_history with(security_invoker=true) as
select p.id,p.organization_id,s.project_id,s.scope_change_id,p.schedule_id,p.amount_cents,p.paid_on,
  p.reference,p.state,p.version,p.reversal_reason,p.created_at,k.name package_name
from public.payments p
join public.payment_schedules s on s.organization_id=p.organization_id and s.id=p.schedule_id
left join public.project_service_packages k on k.organization_id=p.organization_id and k.id=p.package_id
where p.deleted_at is null;
revoke all on public.project_payment_history from public,anon,authenticated;
grant select on public.project_payment_history to authenticated;

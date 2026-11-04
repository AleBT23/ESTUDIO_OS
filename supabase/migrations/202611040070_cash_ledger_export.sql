-- Una sola instantánea por archivo, incluidos los reversos identificados como tales.
create function public.cash_ledger_export(org uuid,from_date date default null,to_date date default null,
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
   select 'proyecto',e.id,'project_plan',p.client_id,p.id,null,null,null,null,null,e.reversed_at
   from public.payments e join public.payment_schedules s on s.organization_id=e.organization_id and s.id=e.schedule_id
   join public.projects p on p.organization_id=s.organization_id and p.id=s.project_id where e.organization_id=org and e.deleted_at is null
 ), limited as (
 select r.id,r.source,r.paid_on,r.concept,r.client_name,r.project_name,r.work_name,m.supplier,
 m.area,r.managed,r.direction,r.amount,r.reference,m.expense_category,r.reversed,m.reversed_at,r.reversal_reason
 from public.movement_receipts r join metadata m on m.source=r.source and m.id=r.id
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

alter table public.quote_items add column unit_cost_cents bigint check (unit_cost_cents between 0 and 99999999999999);
alter table public.quotes add column direct_cost_cents bigint not null default 0,
  add check (direct_cost_cents>=0 and direct_cost_cents+coalesce(round(estimated_hours*hourly_cost_cents),0)+external_cost_cents<=9007199254740991);
create or replace function public.save_quote_draft(org uuid,quote uuid,expected_version integer,header jsonb,items jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid;item jsonb;idx integer:=0;base bigint;disc bigint;sub bigint:=0;discount bigint:=0;tax bigint;rate numeric; direct_cost numeric:=0;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 100 then raise exception 'Agrega entre 1 y 100 partidas';end if;
 if (header->>'vat_rate')::numeric<>round((header->>'vat_rate')::numeric,4) or (header->>'advance_rate')::numeric<>round((header->>'advance_rate')::numeric,4) then raise exception 'Precisión de porcentaje inválida';end if;
 if not exists(select 1 from public.clients where organization_id=org and id=(header->>'client_id')::uuid and deleted_at is null) then raise exception 'Cliente no disponible';end if;
 if quote is null then
  insert into public.quotes(organization_id,client_id,name,vat_rate,apply_vat,advance_rate,valid_until,notes,conditions,estimated_hours,external_cost_cents)
  values(org,(header->>'client_id')::uuid,trim(header->>'name'),(header->>'vat_rate')::numeric,(header->>'apply_vat')::boolean,(header->>'advance_rate')::numeric,(header->>'valid_until')::date,coalesce(header->>'notes',''),coalesce(header->>'conditions',''),coalesce((header->>'estimated_hours')::numeric,0),coalesce((header->>'external_cost_cents')::bigint,0)) returning id into target;
 else
  select id into target from public.quotes where organization_id=org and id=quote and version=expected_version and status='draft' and deleted_at is null for update;
  if target is null then raise exception 'Conflicto de edición o propuesta emitida';end if;
  -- La actualización única de cabecera ocurre al final, para incrementar versión una sola vez.
  -- Los formularios anteriores no envían costos. Solo reutilizarlos si la correspondencia es inequívoca.
  if not exists(select 1 from jsonb_array_elements(items) v where v ? 'unit_cost_cents')
     and exists(select 1 from public.quote_items where quote_id=target and unit_cost_cents is not null) then
    if exists(select 1 from public.quote_items i where i.quote_id=target and i.unit_cost_cents is not null and
      (items->i.position is null or (items->i.position->>'name',items->i.position->>'business_line_id',nullif(items->i.position->>'service_id',''),items->i.position->>'unit')
        is distinct from (i.name,i.business_line_id::text,i.service_id::text,i.unit)))
    then raise exception 'Recarga el editor para conservar los costos por partida';end if;
    select jsonb_agg(v || jsonb_build_object('unit_cost_cents',i.unit_cost_cents) order by pos) into items
    from jsonb_array_elements(items) with ordinality incoming(v,pos)
    left join public.quote_items i on i.quote_id=target and i.position=pos-1;
  end if;
  delete from public.quote_items where organization_id=org and quote_id=target;
 end if;
 for item in select value from jsonb_array_elements(items) loop
  if (item->>'quantity')::numeric<>round((item->>'quantity')::numeric,4) or (item->>'discount_rate')::numeric<>round((item->>'discount_rate')::numeric,4) or (item->>'unit_price_cents')::numeric<>round((item->>'unit_price_cents')::numeric) then raise exception 'Precisión de importe inválida';end if;
  insert into public.quote_items(organization_id,quote_id,business_line_id,service_id,name,description,quantity,unit,unit_price_cents,discount_rate,position,unit_cost_cents)
  values(org,target,(item->>'business_line_id')::uuid,nullif(item->>'service_id','')::uuid,trim(item->>'name'),coalesce(item->>'description',''),(item->>'quantity')::numeric,item->>'unit',(item->>'unit_price_cents')::bigint,(item->>'discount_rate')::numeric,idx,(item->>'unit_cost_cents')::bigint);
  direct_cost:=direct_cost+coalesce(round((item->>'unit_cost_cents')::bigint*case when item->>'unit'='pct' then 1 else (item->>'quantity')::numeric end),0);
  base:=round((item->>'quantity')::numeric*(item->>'unit_price_cents')::numeric/case when item->>'unit'='pct' then 100 else 1 end);
  disc:=round(base*(item->>'discount_rate')::numeric/100); sub:=sub+base;discount:=discount+disc;idx:=idx+1;
 end loop;
 rate:=(header->>'vat_rate')::numeric;
 tax:=case when (header->>'apply_vat')::boolean then round((sub-discount)*rate/100) else 0 end;
 if sub+tax>9007199254740991 then raise exception 'Importe fuera de rango';end if;
 update public.quotes set client_id=(header->>'client_id')::uuid,name=trim(header->>'name'),vat_rate=rate,apply_vat=(header->>'apply_vat')::boolean,
  advance_rate=(header->>'advance_rate')::numeric,valid_until=(header->>'valid_until')::date,notes=coalesce(header->>'notes',''),conditions=coalesce(header->>'conditions',''),
  direct_cost_cents=direct_cost,hourly_cost_cents=case when header ? 'hourly_cost_cents' then (header->>'hourly_cost_cents')::bigint else hourly_cost_cents end,
  estimated_hours=coalesce((header->>'estimated_hours')::numeric,0),external_cost_cents=coalesce((header->>'external_cost_cents')::bigint,0),subtotal_cents=sub,discount_cents=discount,tax_cents=tax,total_cents=sub-discount+tax
 where id=target and organization_id=org;
 return target;
end $$;
create or replace view public.quote_fee_estimates with (security_invoker=true) as
select organization_id,id,net::text as revenue_cents,labor::text as labor_cents,
  profit::text as profit_cents,round(100*profit/nullif(net,0),2)::text as margin_pct,direct_cost_cents::text as item_cost_cents
from (
  select costs.*,net-direct_cost_cents-external_cost_cents-coalesce(labor,0) as profit
  from (select organization_id,id,(subtotal_cents-discount_cents)::numeric net,external_cost_cents,direct_cost_cents,
    round(estimated_hours*hourly_cost_cents) labor from public.quotes) costs
) estimate;
revoke all on public.quote_fee_estimates from public,anon;
grant select on public.quote_fee_estimates to authenticated;

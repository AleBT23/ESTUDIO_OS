-- No reconstruir estimaciones de versiones antiguas a partir del catálogo actual.
alter table public.quote_versions add column internal_estimate jsonb;
create function private.snapshot_quote_estimate() returns trigger language plpgsql set search_path='' as $$
begin
  select jsonb_build_object(
    'revenue',e.revenue_cents,'direct',e.item_cost_cents,'external',q.external_cost_cents::text,
    'hours',q.estimated_hours::text,'hourly_cost',q.hourly_cost_cents::text,'labor',e.labor_cents,
    'profit',e.profit_cents,'margin',e.margin_pct,
    'items',(select jsonb_agg(jsonb_build_object('name',i.name,'line',i.business_line_id,'unit',i.unit,
      'quantity',i.quantity::text,'unit_cost',i.unit_cost_cents::text,
      'total_cost',round(i.unit_cost_cents*case when i.unit='pct' then 1 else i.quantity end)::text) order by i.position)
      from public.quote_items i where i.organization_id=q.organization_id and i.quote_id=q.id)
  ) into strict new.internal_estimate from public.quotes q join public.quote_fee_estimates e
    on e.organization_id=q.organization_id and e.id=q.id
    where q.organization_id=new.organization_id and q.id=new.quote_id and q.version=new.draft_version;
  return new;
end $$;
revoke all on function private.snapshot_quote_estimate() from public,anon,authenticated;
create trigger capture_quote_estimate before insert on public.quote_versions for each row execute function private.snapshot_quote_estimate();

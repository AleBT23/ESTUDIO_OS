-- Archivo recuperable: no borra partidas, clientes, documentos ni movimientos.
create function private.guard_quote_archive() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.deleted_at is not null then
  raise exception 'La cotización está eliminada; no admite operaciones comerciales' using errcode='PQ002';
 end if;
 if new.deleted_at is not null and (
  old.status='accepted' or exists(
   select 1 from public.projects p join public.quote_versions v on v.id=p.quote_version_id
   where v.organization_id=old.organization_id and v.quote_id=old.id
  )
 ) then
  raise exception 'Conserva la cotización vinculada al proyecto y sus obligaciones' using errcode='PQ001';
 end if;
 return new;
end $$;
revoke all on function private.guard_quote_archive() from public,anon,authenticated;
create trigger quote_archive_guard before update on public.quotes
for each row execute function private.guard_quote_archive();

create function public.archive_quote(org uuid,quote uuid,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare target public.quotes;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then
  raise exception 'Permisos insuficientes' using errcode='42501';
 end if;
 select * into target from public.quotes where organization_id=org and id=quote
  and version=expected_version and deleted_at is null for update;
 if target.id is null then
  raise exception 'La cotización cambió o ya fue eliminada' using errcode='PQ002';
 end if;
 update public.quotes set deleted_at=clock_timestamp() where organization_id=org and id=quote;
end $$;
revoke all on function public.archive_quote(uuid,uuid,integer) from public,anon;
grant execute on function public.archive_quote(uuid,uuid,integer) to authenticated;

-- Copia la clave de catálogo al guardar partidas; snapshots anteriores no cambian.
alter table public.quote_items add column code text not null default '';
create function private.capture_quote_item_code() returns trigger
language plpgsql set search_path='' as $$
begin
 new.code:=coalesce((select s.code from public.services s
  where s.id=new.service_id and s.organization_id=new.organization_id),'');
 return new;
end $$;
revoke all on function private.capture_quote_item_code() from public,anon,authenticated;
create trigger quote_item_code before insert on public.quote_items
for each row execute function private.capture_quote_item_code();

-- Agrega clave únicamente a nuevas versiones; no modifica snapshots emitidos.
create or replace function public.prepare_quote_version(org uuid,quote uuid,expected_version integer,options jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.quotes;v public.quote_versions;seq integer;yr integer;folio text;target uuid:=gen_random_uuid();snap jsonb;client jsonb;organization jsonb;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select * into q from public.quotes where organization_id=org and id=quote and version=expected_version and status='draft' and deleted_at is null for update;
 if q.id is null then raise exception 'Conflicto de edición o estado';end if;
 if not (options->'sections' @> '["budget"]'::jsonb) then raise exception 'Presupuesto obligatorio';end if;
 select * into v from public.quote_versions where quote_id=quote and draft_version=expected_version;
 if v.id is not null then
  if (v.snapshot->'options') is distinct from options then raise exception 'La preparación anterior usa otras opciones; guarda una nueva edición';end if;
  return jsonb_build_object('id',v.id,'snapshot',v.snapshot,'storage_path',v.storage_path,'state',v.state);
 end if;
 if not exists(select 1 from public.quote_items where quote_id=quote and organization_id=org) then raise exception 'Sin partidas';end if;
 select jsonb_build_object('name',name,'email',email,'phone',phone,'address',address) into client from public.clients where organization_id=org and id=q.client_id;
 select jsonb_build_object('name',name),extract(year from now() at time zone timezone)::integer into organization,yr from public.organizations where id=org;
 insert into public.folio_counters(organization_id,year,last_value) values(org,yr,1) on conflict(organization_id,year) do update set last_value=public.folio_counters.last_value+1 returning last_value into seq;
 folio:='COT-'||yr::text||'-'||lpad(seq::text,greatest(4,char_length(seq::text)),'0');
 snap:=jsonb_build_object('folio',folio,'issued_at',now(),'organization',organization,'client',client,
  'quote',jsonb_build_object('name',q.name,'currency',q.currency,'vat_rate',q.vat_rate,'apply_vat',q.apply_vat,'advance_rate',q.advance_rate,'valid_until',q.valid_until,'notes',q.notes,'conditions',q.conditions,'subtotal_cents',q.subtotal_cents,'discount_cents',q.discount_cents,'tax_cents',q.tax_cents,'total_cents',q.total_cents),
  'items',(select jsonb_agg(jsonb_build_object('code',i.code,'name',i.name,'description',i.description,'quantity',i.quantity,'unit',i.unit,'unit_price_cents',i.unit_price_cents,'discount_rate',i.discount_rate,'business_line_id',i.business_line_id) order by i.position) from public.quote_items i where i.organization_id=org and i.quote_id=quote),'options',options);
 insert into public.quote_versions(id,organization_id,quote_id,draft_version,version_number,folio,snapshot,storage_path)
 values(target,org,quote,expected_version,(select coalesce(max(version_number),0)+1 from public.quote_versions where quote_id=quote),folio,snap,org::text||'/'||target::text||'.pdf') returning * into v;
 return jsonb_build_object('id',v.id,'snapshot',v.snapshot,'storage_path',v.storage_path,'state',v.state);
end $$;

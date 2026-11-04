create function public.stage_legacy_preset(org uuid,item jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare
  original text:=item->>'id';
  title text:=btrim(item->>'name');
  refs jsonb:=item->'serviceIds';
  items jsonb;
  existing jsonb;
  prior public.service_presets;
  target uuid;
begin
  if not private.has_role(org,array['owner']::public.member_role[]) or not exists(
    select 1 from private.legacy_staging_targets where organization_id=org
  ) then raise exception 'Destino de staging no habilitado' using errcode='42501'; end if;
  if not coalesce(jsonb_typeof(item->'id')='string' and length(btrim(original)) between 1 and 160
    and jsonb_typeof(item->'name')='string' and length(title) between 2 and 160
    and jsonb_typeof(refs)='array',false) then raise exception 'Preset inválido'; end if;
  if jsonb_array_length(refs) not between 1 and 100 or exists(
    select 1 from jsonb_array_elements(refs) r where jsonb_typeof(r)<>'string'
  ) then raise exception 'Referencias inválidas'; end if;
  lock table public.services in share mode;
  lock table public.service_presets in share row exclusive mode;
  select jsonb_agg(jsonb_build_object('service_id',s.id,'quantity',1) order by r.pos) into items
  from jsonb_array_elements_text(refs) with ordinality r(original_id,pos)
  join public.services s on s.organization_id=org and s.legacy_id=r.original_id and s.deleted_at is null;
  if coalesce(jsonb_array_length(items),0)<>jsonb_array_length(refs) then raise exception 'Faltan servicios activos del preset'; end if;
  select * into prior from public.service_presets where organization_id=org and legacy_id=original;
  if found then
    select jsonb_agg(jsonb_build_object('service_id',i.service_id,'quantity',i.quantity) order by i.position)
      into existing from public.preset_items i where i.organization_id=org and i.preset_id=prior.id;
    if prior.deleted_at is not null or prior.name<>title or existing is distinct from items
    then raise exception 'El preset existente tiene datos distintos'; end if;
    return 'unchanged';
  end if;
  if exists(select 1 from public.service_presets where organization_id=org and lower(btrim(name))=lower(title))
  then raise exception 'Nombre ambiguo en el catálogo'; end if;
  target:=public.save_preset(org,null,0,title,'',items);
  update public.service_presets set legacy_id=original where organization_id=org and id=target;
  return 'inserted';
end $$;
revoke all on function public.stage_legacy_preset(uuid,jsonb) from public,anon;
grant execute on function public.stage_legacy_preset(uuid,jsonb) to authenticated;

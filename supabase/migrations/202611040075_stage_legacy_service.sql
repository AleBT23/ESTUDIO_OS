create function public.stage_legacy_service(org uuid,line uuid,item jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare
  original text := item->>'id';
  title text := btrim(item->>'name');
  unit_name text := item->>'unit';
  details text := coalesce(item->>'description','');
  active boolean;
  cents numeric;
  prior public.services;
begin
  if not private.has_role(org,array['owner']::public.member_role[]) or not exists(
    select 1 from private.legacy_staging_targets where organization_id=org
  ) then raise exception 'Destino de staging no habilitado' using errcode='42501'; end if;
  if not exists(select 1 from public.business_lines where organization_id=org and id=line) then raise exception 'Línea inválida'; end if;
  if not coalesce(jsonb_typeof(item->'id')='string' and length(btrim(original)) between 1 and 160
    and jsonb_typeof(item->'name')='string' and length(title) between 2 and 160
    and unit_name in ('m2','unit','hour','visit','fixed','pct') and length(details)<=10000
    and (not item ? 'description' or jsonb_typeof(item->'description')='string')
    and jsonb_typeof(item->'active')='boolean' and jsonb_typeof(item->'price')='number',false)
  then raise exception 'Servicio inválido'; end if;
  cents := (item->>'price')::numeric*100;
  active := (item->>'active')::boolean;
  if cents<>trunc(cents) or cents not between 0 and 99999999999999 or (unit_name='pct' and cents>10000)
  then raise exception 'Precio o porcentaje inválido'; end if;
  lock table public.services in share row exclusive mode;
  select * into prior from public.services where organization_id=org and legacy_id=original;
  if found then
    if (prior.business_line_id,prior.name,prior.unit,prior.price_cents,prior.description,(prior.deleted_at is null))
      is distinct from (line,title,unit_name,cents,details,active)
    then raise exception 'El servicio existente tiene datos distintos'; end if;
    return 'unchanged';
  end if;
  if exists(select 1 from public.services where organization_id=org and lower(btrim(name))=lower(title))
  then raise exception 'Nombre ambiguo en el catálogo'; end if;
  insert into public.services(organization_id,business_line_id,legacy_id,code,name,unit,price_cents,description,deleted_at)
    values(org,line,original,'LEG-'||md5(original),title,unit_name,cents,details,case when not active then now() end);
  return 'inserted';
end $$;
revoke all on function public.stage_legacy_service(uuid,uuid,jsonb) from public,anon;
grant execute on function public.stage_legacy_service(uuid,uuid,jsonb) to authenticated;

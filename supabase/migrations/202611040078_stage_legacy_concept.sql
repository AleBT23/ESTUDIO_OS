create function public.stage_legacy_concept(org uuid,item jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare prior public.concepts; original text:=item->>'id'; title text:=btrim(item->>'name'); body_text text:=item->>'text';
begin
 if not private.has_role(org,array['owner']::public.member_role[]) or not exists(select 1 from private.legacy_staging_targets where organization_id=org)
 then raise exception 'Destino de staging no habilitado' using errcode='42501';end if;
 if not coalesce(jsonb_typeof(item->'id')='string' and length(btrim(original)) between 1 and 160
    and jsonb_typeof(item->'name')='string' and length(title) between 2 and 160
    and jsonb_typeof(item->'text')='string' and length(body_text) between 1 and 10000 and btrim(body_text)<>'',false)
 then raise exception 'Concepto inválido';end if;
 lock table public.concepts in share row exclusive mode;
 select * into prior from public.concepts where organization_id=org and legacy_id=original;
 if found then
   if prior.deleted_at is not null or (prior.name,prior.body) is distinct from (title,body_text)
   then raise exception 'El concepto existente tiene datos distintos';end if;
   return 'unchanged';
 end if;
 if exists(select 1 from public.concepts where organization_id=org and lower(btrim(name))=lower(title))
 then raise exception 'Nombre ambiguo en el catálogo';end if;
 insert into public.concepts(organization_id,legacy_id,name,body) values(org,original,title,body_text);
 return 'inserted';
end $$;
revoke all on function public.stage_legacy_concept(uuid,jsonb) from public,anon;
grant execute on function public.stage_legacy_concept(uuid,jsonb) to authenticated;

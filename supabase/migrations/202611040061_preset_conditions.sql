alter table public.service_presets add column conditions text not null default '' check(length(conditions)<=20000);
create function public.save_preset_terms(org uuid,preset uuid,expected_version integer,preset_name text,preset_notes text,items jsonb,preset_conditions text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid; item jsonb; idx integer:=0;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 100 then raise exception 'Selecciona entre 1 y 100 servicios';end if;
 if preset is null then insert into public.service_presets(organization_id,name,notes,conditions) values(org,trim(preset_name),preset_notes,coalesce(preset_conditions,'')) returning id into target;
 else
  update public.service_presets set name=trim(preset_name),notes=preset_notes,conditions=coalesce(preset_conditions,conditions) where organization_id=org and id=preset and version=expected_version and deleted_at is null returning id into target;
  if target is null then raise exception 'Conflicto de edición';end if;
  delete from public.preset_items where organization_id=org and preset_id=target;
 end if;
 for item in select value from jsonb_array_elements(items) loop
  if not exists(select 1 from public.services where organization_id=org and id=(item->>'service_id')::uuid and deleted_at is null) then raise exception 'Servicio no disponible';end if;
  insert into public.preset_items(organization_id,preset_id,service_id,quantity,position) values(org,target,(item->>'service_id')::uuid,(item->>'quantity')::numeric,idx);idx:=idx+1;
 end loop;
 return target;
end $$;
revoke all on function public.save_preset_terms(uuid,uuid,integer,text,text,jsonb,text) from public,anon;
grant execute on function public.save_preset_terms(uuid,uuid,integer,text,text,jsonb,text) to authenticated;
create or replace function public.save_preset(org uuid,preset uuid,expected_version integer,preset_name text,preset_notes text,items jsonb) returns uuid language sql security definer set search_path='' as '
 select public.save_preset_terms(org,preset,expected_version,preset_name,preset_notes,items,null);
';
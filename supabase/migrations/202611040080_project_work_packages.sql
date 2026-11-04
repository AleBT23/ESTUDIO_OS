alter table public.project_service_packages
  add column manual boolean not null default false,
  add column execution_notes text not null default '' check(length(execution_notes)<=6000);

-- Las fases automáticas corresponden a contratos aceptados.
drop trigger quote_package_phases on public.project_service_packages;
create trigger quote_package_phases after insert on public.project_service_packages
for each row when (not new.manual) execute function private.apply_quote_package_phases();

create function public.save_work_package(org uuid,project uuid,package uuid,expected_version integer,
  line uuid,title text,instructions text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target public.project_service_packages;
begin
  if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes' using errcode='42501';end if;
  if package is null or not coalesce(length(btrim(title)) between 2 and 160 and length(instructions)<=6000 and expected_version>=0,false)
  then raise exception 'Datos del paquete inválidos';end if;
  perform 1 from public.projects where organization_id=org and id=project and state in ('active','paused') and deleted_at is null for share;
  if not found then raise exception 'Proyecto no disponible';end if;
  if expected_version=0 then
    insert into public.project_service_packages(id,organization_id,project_id,business_line_id,name,scope,manual,execution_notes)
    values(package,org,project,line,btrim(title),'[]',true,instructions) on conflict(id) do nothing;
    if not found then
      select * into target from public.project_service_packages where organization_id=org and project_id=project and id=package;
      if not found or not target.manual or target.deleted_at is not null or
        (target.business_line_id,target.name,target.execution_notes) is distinct from (line,btrim(title),instructions)
      then raise exception 'Identificador de paquete ya utilizado';end if;
    end if;
  else
    update public.project_service_packages set name=btrim(title),execution_notes=instructions
    where organization_id=org and project_id=project and id=package and business_line_id=line and version=expected_version and deleted_at is null;
    if not found then raise exception 'El paquete cambió, vuelve a cargarlo';end if;
  end if;
  return package;
end $$;
revoke all on function public.save_work_package(uuid,uuid,uuid,integer,uuid,text,text) from public,anon;
grant execute on function public.save_work_package(uuid,uuid,uuid,integer,uuid,text,text) to authenticated;

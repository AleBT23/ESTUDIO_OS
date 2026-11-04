-- El operador habilita únicamente organizaciones de un destino aislado.
create table private.legacy_staging_targets (
 organization_id uuid primary key references public.organizations(id)
);
revoke all on private.legacy_staging_targets from public,anon,authenticated;

create function public.stage_legacy_clients(org uuid, batch jsonb, client_kind text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare imported integer:=0; unchanged integer:=0; item record; prior public.clients;
begin
 if not private.has_role(org,array['owner']::public.member_role[]) or not exists(select 1 from private.legacy_staging_targets where organization_id=org)
 then raise exception 'Estudio de staging no habilitado' using errcode='42501';end if;
 if jsonb_typeof(batch) is distinct from 'array' or jsonb_array_length(batch) not between 1 and 2000 or client_kind is null or client_kind not in ('person','company')
 then raise exception 'Lote inválido';end if;
 -- Serializar revisión e inserción frente a ediciones manuales en el destino de ensayo.
 lock table public.clients in share row exclusive mode;
 if exists(select 1 from jsonb_array_elements(batch) e group by trim(e->>'id') having count(*)>1)
 or exists(select 1 from jsonb_array_elements(batch) e group by lower(trim(e->>'name')) having count(*)>1)
 or exists(select 1 from jsonb_array_elements(batch) e where trim(e->>'email')<>'' group by lower(trim(e->>'email')) having count(*)>1)
 then raise exception 'Identificador, nombre o correo repetido en el lote';end if;
 for item in select trim(id) legacy_id,trim(name) name,trim(coalesce(email,'')) email,trim(coalesce(phone,'')) phone
 from jsonb_to_recordset(batch) as r(id text,name text,email text,phone text)
 loop
   if item.legacy_id is null or length(item.legacy_id) not between 1 and 160 or item.name is null or length(item.name) not between 2 and 160
     or length(item.phone)>40 or length(item.email)>254 then raise exception 'Campos de cliente inválidos'; end if;
   select * into prior from public.clients c where c.organization_id=org and c.legacy_id=item.legacy_id;
   if found then
     if prior.deleted_at is not null or (prior.name,prior.email,prior.phone,prior.kind) is distinct from (item.name,item.email,item.phone,client_kind)
     then raise exception 'El cliente ya existe con datos distintos';end if;
     unchanged:=unchanged+1;
   else
     if exists(select 1 from public.clients c where c.organization_id=org and (lower(trim(c.name))=lower(item.name) or (item.email<>'' and lower(trim(c.email))=lower(item.email))))
     then raise exception 'Posible duplicado del directorio';end if;
     insert into public.clients(organization_id,legacy_id,name,email,phone,kind,source) values(org,item.legacy_id,item.name,item.email,item.phone,client_kind,'Tabulador legado');
     imported:=imported+1;
   end if;
 end loop;
 return jsonb_build_object('inserted',imported,'unchanged',unchanged);
end $$;
revoke all on function public.stage_legacy_clients(uuid,jsonb,text) from public,anon;
grant execute on function public.stage_legacy_clients(uuid,jsonb,text) to authenticated;

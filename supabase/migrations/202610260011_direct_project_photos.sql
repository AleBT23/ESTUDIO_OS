-- Preparada localmente. No aplicar a producción sin autorización.
-- Bucket temporal privado: no cambia archivos ni observaciones existentes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-photo-uploads','project-photo-uploads',false,2097152,array['image/jpeg']);

create function private.temporary_project_photo_access(object_name text, writing boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.project_photos f
  join public.project_observations o on o.organization_id=f.organization_id and o.id=f.observation_id
  join public.projects p on p.organization_id=o.organization_id and p.id=o.project_id
  where f.storage_path=object_name and o.created_by=auth.uid()
    and o.deleted_at is null and p.deleted_at is null
    and private.has_role(f.organization_id,array['owner','admin','collaborator']::public.member_role[])
    and (not writing or not o.published)
 );
$$;
revoke all on function private.temporary_project_photo_access(text,boolean) from public,anon;
grant execute on function private.temporary_project_photo_access(text,boolean) to authenticated;

create policy temporary_photos_read on storage.objects for select to authenticated
using(bucket_id='project-photo-uploads' and private.temporary_project_photo_access(name,false));
create policy temporary_photos_insert on storage.objects for insert to authenticated
with check(bucket_id='project-photo-uploads' and private.temporary_project_photo_access(name,true));
-- El autor puede retirar el temporal tras publicar; nunca el definitivo publicado.
create policy temporary_photos_cleanup on storage.objects for delete to authenticated
using(bucket_id='project-photo-uploads' and private.temporary_project_photo_access(name,false));
create policy temporary_photos_anon_block on storage.objects as restrictive for all to anon
using(bucket_id<>'project-photo-uploads') with check(bucket_id<>'project-photo-uploads');
create policy temporary_photos_update_block on storage.objects as restrictive for update to authenticated
using(bucket_id<>'project-photo-uploads') with check(bucket_id<>'project-photo-uploads');
create policy temporary_photos_limit_read on storage.objects as restrictive for select to authenticated
using(bucket_id<>'project-photo-uploads' or private.temporary_project_photo_access(name,false));
create policy temporary_photos_limit_insert on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'project-photo-uploads' or private.temporary_project_photo_access(name,true));
create policy temporary_photos_limit_delete on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'project-photo-uploads' or private.temporary_project_photo_access(name,false));

-- Lectura del definitivo en preparación solo para su autor con permisos.
-- Permite confirmar reintentos y que DELETE de Storage encuentre borradores.
-- Mantiene la inmutabilidad y los permisos de lectura de lo ya publicado.
create or replace function private.project_photo_access(object_name text,writing boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.project_photos f
  join public.project_observations o on o.organization_id=f.organization_id and o.id=f.observation_id
  join public.projects p on p.organization_id=o.organization_id and p.id=o.project_id
  where f.storage_path=object_name and o.deleted_at is null and p.deleted_at is null and
  case when writing then not o.published and o.created_by=auth.uid()
    and private.has_role(f.organization_id,array['owner','admin','collaborator']::public.member_role[])
  else (o.published and private.has_role(f.organization_id,array['owner','admin','collaborator','reader']::public.member_role[]))
    or (not o.published and o.created_by=auth.uid()
      and private.has_role(f.organization_id,array['owner','admin','collaborator']::public.member_role[])) end
 );
$$;

-- Solo se corrige el tamaño real de la copia canónica; no se permite mover fotos.
grant update(byte_size) on public.project_photos to authenticated;
create policy photo_prepared_size on public.project_photos for update to authenticated
using(private.temporary_project_photo_access(storage_path,true))
with check(private.temporary_project_photo_access(storage_path,true));

-- Preparación atómica e idempotente: una respuesta perdida no deja fotos a medias.
create function public.prepare_project_observation(
 org uuid, project uuid, observation uuid, visit_body text, visit_date date, photo_sizes integer[]
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.project_observations; photo_ids uuid[]; i integer; result jsonb;
begin
 if not private.has_role(org,array['owner','admin','collaborator']::public.member_role[])
 then raise exception 'Permisos insuficientes' using errcode='42501'; end if;
 if observation is null or visit_body is null or char_length(trim(visit_body)) not between 1 and 10000
   or visit_date is null or visit_date > (now() at time zone (select timezone from public.organizations where id=org))::date
   or photo_sizes is null or cardinality(photo_sizes)>5 or coalesce(array_ndims(photo_sizes),1)>1
   or exists(select 1 from unnest(photo_sizes) size where size is null or size not between 1 and 2097152)
 then raise exception 'Revisa la visita y las fotografías'; end if;
 if not exists(select 1 from public.projects p where p.id=project and p.organization_id=org and p.deleted_at is null)
 then raise exception 'Proyecto no disponible'; end if;
 perform pg_advisory_xact_lock(hashtext(org::text||observation::text));
 select * into existing from public.project_observations o where o.id=observation;
 if existing.id is not null then
   if existing.organization_id<>org or existing.project_id<>project or existing.created_by<>auth.uid()
     or existing.deleted_at is not null or existing.body<>trim(visit_body) or existing.observed_on<>visit_date
     or (select count(*) from public.project_photos f where f.observation_id=observation and f.organization_id=org)<>cardinality(photo_sizes)
   then raise exception 'El intento ya corresponde a otro registro'; end if;
 else
   insert into public.project_observations(id,organization_id,project_id,body,observed_on)
   values(observation,org,project,trim(visit_body),visit_date);
   -- Orden estable de identificadores, igual al orden de los archivos del formulario.
   select array_agg(id order by id) into photo_ids
   from (select gen_random_uuid() id from generate_series(1,cardinality(photo_sizes))) generated;
   for i in 1..cardinality(photo_sizes) loop
     insert into public.project_photos(id,organization_id,observation_id,storage_path,byte_size)
     values(photo_ids[i],org,observation,org::text||'/'||observation::text||'/'||photo_ids[i]::text||'.jpg',photo_sizes[i]);
   end loop;
 end if;
 select jsonb_build_object('observation',observation,'photos',coalesce(
   jsonb_agg(jsonb_build_object('path',f.storage_path,'size',f.byte_size) order by f.id),
   '[]'::jsonb)) into result from public.project_photos f
   where f.organization_id=org and f.observation_id=observation;
 return result;
end $$;
revoke all on function public.prepare_project_observation(uuid,uuid,uuid,text,date,integer[]) from public,anon;
grant execute on function public.prepare_project_observation(uuid,uuid,uuid,text,date,integer[]) to authenticated;

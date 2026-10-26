-- Expediente manual, pendientes y bitácora: datos compartidos por organización.
alter table public.projects alter column quote_version_id drop not null;
alter table public.projects add column creation_request_id uuid;
create unique index project_creation_request on public.projects(organization_id,creation_request_id) where creation_request_id is not null;

create table public.project_notes(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),project_id uuid not null,
 kind text not null default 'task' check(kind in ('task','note')),body text not null check(char_length(trim(body)) between 1 and 10000),
 due_on date,completed_at timestamptz,created_by uuid not null default auth.uid() references auth.users(id),
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),foreign key(organization_id,project_id) references public.projects(organization_id,id),
 check(kind='task' or completed_at is null)
);
create index project_notes_pending on public.project_notes(organization_id,completed_at,due_on) where deleted_at is null;
create table public.project_observations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),project_id uuid not null,
 body text not null check(char_length(trim(body)) between 1 and 10000),observed_on date not null,published boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id),version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create index project_observations_date on public.project_observations(organization_id,project_id,observed_on desc);
create table public.project_photos(
 id uuid primary key,organization_id uuid not null references public.organizations(id),observation_id uuid not null,
 storage_path text not null unique,byte_size integer not null check(byte_size between 1 and 2097152),
 created_at timestamptz not null default now(),
 foreign key(organization_id,observation_id) references public.project_observations(organization_id,id),
 check(storage_path=organization_id::text||'/'||observation_id::text||'/'||id::text||'.jpg')
);
create function private.guard_project_photo() returns trigger language plpgsql security definer set search_path='' as $$
declare o public.project_observations;begin
 select * into o from public.project_observations where organization_id=new.organization_id and id=new.observation_id for update;
 if o.id is null or o.published or o.created_by<>auth.uid() or not private.has_role(new.organization_id,array['owner','admin','collaborator']::public.member_role[]) then raise exception 'No se pueden agregar fotos a este registro' using errcode='42501';end if;
 if (select count(*) from public.project_photos where organization_id=new.organization_id and observation_id=new.observation_id)>=5 then raise exception 'Máximo cinco fotografías';end if;
 return new;
end $$;
revoke all on function private.guard_project_photo() from public,anon,authenticated;
create trigger project_photo_guard before insert on public.project_photos for each row execute function private.guard_project_photo();
do $$declare tbl text;begin
 foreach tbl in array array['project_notes','project_observations','project_photos'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
 end loop;
 foreach tbl in array array['project_notes','project_observations'] loop
  execute format('create trigger %I before insert or update on public.%I for each row execute function private.track_change()',tbl||'_track',tbl);
  execute format('create policy project_read on public.%I for select to authenticated using(private.has_role(organization_id,array[''owner'',''admin'',''collaborator'',''reader'']::public.member_role[]))',tbl);
  execute format('create policy project_write on public.%I for all to authenticated using(private.has_role(organization_id,array[''owner'',''admin'',''collaborator'']::public.member_role[])) with check(private.has_role(organization_id,array[''owner'',''admin'',''collaborator'']::public.member_role[]) and exists(select 1 from public.projects p where p.organization_id=%I.organization_id and p.id=%I.project_id and p.deleted_at is null))',tbl,tbl,tbl);
 end loop;
end $$;
alter policy project_read on public.project_observations using(private.has_role(organization_id,array['owner','admin','collaborator','reader']::public.member_role[]) and (published or created_by=auth.uid()));
grant insert(organization_id,project_id,kind,body,due_on) on public.project_notes to authenticated;
grant update(body,due_on,completed_at) on public.project_notes to authenticated;
grant insert(id,organization_id,project_id,body,observed_on) on public.project_observations to authenticated;
grant insert(id,organization_id,observation_id,storage_path,byte_size) on public.project_photos to authenticated;
create policy photo_read on public.project_photos for select to authenticated using(private.has_role(organization_id,array['owner','admin','collaborator','reader']::public.member_role[]));
create policy photo_prepare on public.project_photos for insert to authenticated with check(private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[]) and exists(select 1 from public.project_observations o where o.organization_id=project_photos.organization_id and o.id=observation_id and not o.published and o.created_by=auth.uid()));

create view public.project_notes_context with(security_invoker=true) as
 select n.*,p.name project_name from public.project_notes n join public.projects p on p.organization_id=n.organization_id and p.id=n.project_id where p.deleted_at is null;
revoke all on public.project_notes_context from public,anon,authenticated;
grant select on public.project_notes_context to authenticated;
create view public.project_financial_summary with(security_invoker=true) as
 select organization_id,project_id,sum(amount_cents)::bigint amount_cents,sum(collected_cents)::bigint collected_cents,sum(balance_cents)::bigint balance_cents,count(*) schedule_count
 from public.payment_schedule_balances group by organization_id,project_id;
revoke all on public.project_financial_summary from public,anon,authenticated;
grant select on public.project_financial_summary to authenticated;

create function public.create_project_record(org uuid,client uuid,project_name text,start_on date,total bigint,request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid;begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes' using errcode='42501';end if;
 if request_id is null or total is null or total not between 0 and 9007199254740991 or start_on is null or char_length(trim(project_name)) not between 2 and 160 then raise exception 'Revisa proyecto, importe y fecha';end if;
 perform pg_advisory_xact_lock(hashtext(org::text||request_id::text));
 select id into target from public.projects where organization_id=org and creation_request_id=request_id;
 if target is not null then
  if not exists(select 1 from public.projects p where p.id=target and p.client_id=client and p.name=trim(project_name) and p.start_date=start_on and (select coalesce(sum(amount_cents),0) from public.payment_schedules where project_id=p.id)=total) then raise exception 'La solicitud ya corresponde a otro proyecto';end if;
  return target;
 end if;
 if not exists(select 1 from public.clients where organization_id=org and id=client and deleted_at is null) then raise exception 'Cliente no disponible';end if;
 insert into public.projects(organization_id,client_id,name,start_date,creation_request_id) values(org,client,trim(project_name),start_on,request_id) returning id into target;
 if total>0 then insert into public.payment_schedules(organization_id,project_id,label,amount_cents,due_date) values(org,target,'Importe acordado del proyecto',total,start_on);end if;
 return target;
end $$;
create function public.define_project_amount(org uuid,project uuid,expected_version integer,total bigint,due_on date) returns void
language plpgsql security definer set search_path='' as $$
declare p public.projects;begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes' using errcode='42501';end if;
 select * into p from public.projects where organization_id=org and id=project and version=expected_version and deleted_at is null for update;
 if p.id is null or p.quote_version_id is not null or exists(select 1 from public.payment_schedules where project_id=project) then raise exception 'El proyecto cambió o ya tiene un importe acordado';end if;
 if total is null or total not between 1 and 9007199254740991 or due_on is null then raise exception 'Importe o fecha inválidos';end if;
 insert into public.payment_schedules(organization_id,project_id,label,amount_cents,due_date) values(org,project,'Importe acordado del proyecto',total,due_on);
 update public.projects set name=name where organization_id=org and id=project;
end $$;

create function private.project_photo_access(object_name text,writing boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.project_photos f join public.project_observations o on o.organization_id=f.organization_id and o.id=f.observation_id join public.projects p on p.organization_id=o.organization_id and p.id=o.project_id
 where f.storage_path=object_name and o.deleted_at is null and p.deleted_at is null and
 case when writing then not o.published and o.created_by=auth.uid() and private.has_role(f.organization_id,array['owner','admin','collaborator']::public.member_role[])
 else o.published and private.has_role(f.organization_id,array['owner','admin','collaborator','reader']::public.member_role[]) end);
$$;
revoke all on function private.project_photo_access(text,boolean) from public,anon;
grant execute on function private.project_photo_access(text,boolean) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('project-photos','project-photos',false,2097152,array['image/jpeg']);
create policy project_photos_read on storage.objects for select to authenticated using(bucket_id='project-photos' and private.project_photo_access(name,false));
create policy project_photos_insert on storage.objects for insert to authenticated with check(bucket_id='project-photos' and private.project_photo_access(name,true));
create policy project_photos_cleanup on storage.objects for delete to authenticated using(bucket_id='project-photos' and private.project_photo_access(name,true));
create policy project_photos_anon_block on storage.objects as restrictive for all to anon using(bucket_id<>'project-photos') with check(bucket_id<>'project-photos');
create policy project_photos_update_block on storage.objects as restrictive for update to authenticated using(bucket_id<>'project-photos') with check(bucket_id<>'project-photos');
create policy project_photos_limit_read on storage.objects as restrictive for select to authenticated using(bucket_id<>'project-photos' or private.project_photo_access(name,false));
create policy project_photos_limit_insert on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'project-photos' or private.project_photo_access(name,true));
create policy project_photos_limit_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'project-photos' or private.project_photo_access(name,true));

create function public.publish_project_observation(org uuid,observation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.project_observations;begin
 if not private.has_role(org,array['owner','admin','collaborator']::public.member_role[]) then raise exception 'Permisos insuficientes' using errcode='42501';end if;
 select * into o from public.project_observations where organization_id=org and id=observation and created_by=auth.uid() and deleted_at is null for update;
 if o.id is null or not exists(select 1 from public.projects where id=o.project_id and organization_id=org and deleted_at is null) then raise exception 'Observación no disponible';end if;
 if o.published then return;end if;
 if o.observed_on>(now() at time zone (select timezone from public.organizations where id=org))::date then raise exception 'La visita no puede estar en el futuro';end if;
 if (select count(*) from public.project_photos where organization_id=org and observation_id=observation)>5 then raise exception 'Máximo cinco fotografías';end if;
 if exists(select 1 from public.project_photos f where f.organization_id=org and f.observation_id=observation and not exists(select 1 from storage.objects s where s.bucket_id='project-photos' and s.name=f.storage_path)) then raise exception 'Hay fotografías sin guardar';end if;
 update public.project_observations set published=true where id=observation and organization_id=org;
end $$;
create function public.discard_project_observation(org uuid,observation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(org,array['owner','admin','collaborator']::public.member_role[]) then raise exception 'Permisos insuficientes' using errcode='42501';end if;
 perform 1 from public.project_observations where organization_id=org and id=observation and created_by=auth.uid() and not published for update;
 if not found then raise exception 'No se elimina una observación publicada';end if;
 if exists(select 1 from public.project_photos f join storage.objects s on s.name=f.storage_path and s.bucket_id='project-photos' where f.organization_id=org and f.observation_id=observation) then raise exception 'Primero retira los archivos preparados';end if;
 delete from public.project_photos where organization_id=org and observation_id=observation;
 delete from public.project_observations where organization_id=org and id=observation;
end $$;
do $$declare sig text;begin
 foreach sig in array array['create_project_record(uuid,uuid,text,date,bigint,uuid)','define_project_amount(uuid,uuid,integer,bigint,date)','publish_project_observation(uuid,uuid)','discard_project_observation(uuid,uuid)'] loop
  execute 'revoke all on function public.'||sig||' from public,anon';
  execute 'grant execute on function public.'||sig||' to authenticated';
 end loop;
end $$;

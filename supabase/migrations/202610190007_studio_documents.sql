create table public.studio_documents(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),client_id uuid,project_id uuid,
 title text not null check(char_length(title) between 2 and 160),kind text not null check(kind in ('letter','official','minutes','site_report')),
 body text not null check(char_length(body) between 1 and 40000),margins jsonb not null,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),foreign key(organization_id,client_id) references public.clients(organization_id,id),foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create index studio_documents_org_title on public.studio_documents(organization_id,lower(title));
create table public.generated_documents(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),document_id uuid not null,
 draft_version integer not null,folio text not null,snapshot jsonb not null,storage_path text not null unique,
 state text not null default 'prepared' check(state in ('prepared','issued')),sha256 text check(sha256~'^[a-f0-9]{64}$'),issued_at timestamptz,created_at timestamptz not null default now(),
 unique(organization_id,id),unique(organization_id,folio),unique(document_id,draft_version),
 foreign key(organization_id,document_id) references public.studio_documents(organization_id,id),
 check(state<>'issued' or (sha256 is not null and issued_at is not null))
);
create trigger studio_documents_track before insert or update on public.studio_documents for each row execute function private.track_change();
alter table public.studio_documents enable row level security;
alter table public.generated_documents enable row level security;
revoke all on public.studio_documents,public.generated_documents from public,anon,authenticated;
grant select on public.studio_documents,public.generated_documents to authenticated;
create policy document_read on public.studio_documents for select to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy generated_read on public.generated_documents for select to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]));

create function public.save_studio_document(org uuid,document uuid,expected_version integer,header jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid;client uuid:=nullif(header->>'client_id','')::uuid;project uuid:=nullif(header->>'project_id','')::uuid;project_client uuid;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 if project is not null then
  select client_id into project_client from public.projects where organization_id=org and id=project and deleted_at is null;
  if project_client is null then raise exception 'Proyecto no disponible';end if;
  if client is not null and client<>project_client then raise exception 'El proyecto pertenece a otro cliente';end if;
  client:=project_client;
 end if;
 if client is not null and not exists(select 1 from public.clients where organization_id=org and id=client and deleted_at is null) then raise exception 'Cliente no disponible';end if;
 if not coalesce((header->'margins'->>'top')::numeric between 22 and 60 and (header->'margins'->>'bottom')::numeric between 26 and 60 and (header->'margins'->>'left')::numeric between 12 and 45 and (header->'margins'->>'right')::numeric between 24 and 50,false) then raise exception 'Márgenes inválidos';end if;
 if document is null then
  insert into public.studio_documents(organization_id,client_id,project_id,title,kind,body,margins) values(org,client,project,trim(header->>'title'),header->>'kind',header->>'body',header->'margins') returning id into target;
 else
  update public.studio_documents set client_id=client,project_id=project,title=trim(header->>'title'),kind=header->>'kind',body=header->>'body',margins=header->'margins'
  where organization_id=org and id=document and version=expected_version and deleted_at is null returning id into target;
  if target is null then raise exception 'Conflicto de edición';end if;
 end if;
 return target;
end $$;
create function public.prepare_studio_document(org uuid,document uuid,expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.studio_documents;v public.generated_documents;target uuid:=gen_random_uuid();seq integer;yr integer;document_date text;organization jsonb;client jsonb;project jsonb;folio text;snap jsonb;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select * into d from public.studio_documents where organization_id=org and id=document and version=expected_version and deleted_at is null for update;
 if d.id is null then raise exception 'Conflicto de edición';end if;
 select * into v from public.generated_documents where document_id=document and draft_version=expected_version;
 if v.id is not null then return jsonb_build_object('id',v.id,'snapshot',v.snapshot,'storage_path',v.storage_path,'state',v.state);end if;
 select jsonb_build_object('name',name),extract(year from now() at time zone timezone)::integer,to_char(now() at time zone timezone,'YYYY-MM-DD') into organization,yr,document_date from public.organizations where id=org;
 if d.client_id is not null then select jsonb_build_object('name',name) into client from public.clients where organization_id=org and id=d.client_id;end if;
 if d.project_id is not null then select jsonb_build_object('name',name) into project from public.projects where organization_id=org and id=d.project_id;end if;
 insert into public.folio_counters(organization_id,year,last_value) values(org,yr,1) on conflict(organization_id,year) do update set last_value=public.folio_counters.last_value+1 returning last_value into seq;
 folio:='DOC-'||yr::text||'-'||lpad(seq::text,greatest(4,char_length(seq::text)),'0');
 snap:=jsonb_build_object('folio',folio,'title',d.title,'kind',d.kind,'body',d.body,'date',document_date,'organization',organization,'client',client,'project',project,'margins',d.margins);
 insert into public.generated_documents(id,organization_id,document_id,draft_version,folio,snapshot,storage_path) values(target,org,document,expected_version,folio,snap,org::text||'/documents/'||target::text||'.pdf') returning * into v;
 return jsonb_build_object('id',v.id,'snapshot',v.snapshot,'storage_path',v.storage_path,'state',v.state);
end $$;
create function public.finalize_studio_document(org uuid,version_id uuid,checksum text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.generated_documents;d public.studio_documents;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select * into v from public.generated_documents where organization_id=org and id=version_id;
 if v.id is null then raise exception 'Versión no encontrada';end if;
 select * into d from public.studio_documents where organization_id=org and id=v.document_id for update;
 select * into v from public.generated_documents where organization_id=org and id=version_id for update;
 if v.state='issued' then
  if v.sha256 is distinct from checksum then raise exception 'La versión emitida tiene otra huella';end if;return;
 end if;
 if d.version<>v.draft_version then raise exception 'El documento cambió';end if;
 if not exists(select 1 from storage.objects where bucket_id='estudio-documents' and name=v.storage_path) then raise exception 'PDF no almacenado';end if;
 update public.generated_documents set state='issued',sha256=checksum,issued_at=clock_timestamp() where organization_id=org and id=version_id;
 insert into public.audit_events(organization_id,actor_id,entity_type,entity_id,action) values(org,auth.uid(),'generated_documents',version_id,'issued');
end $$;

-- Amplía las políticas propias sin retirar la protección de PDFs de cotización.
create function private.document_object_access(object_name text,prepared_only boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.quote_versions v where v.storage_path=object_name and (not prepared_only or v.state='prepared') and private.has_role(v.organization_id,array['owner','admin']::public.member_role[]))
 or exists(select 1 from public.generated_documents d where d.storage_path=object_name and (not prepared_only or d.state='prepared') and private.has_role(d.organization_id,array['owner','admin']::public.member_role[]));
$$;
revoke all on function private.document_object_access(text,boolean) from public;
grant execute on function private.document_object_access(text,boolean) to authenticated;
alter policy estudio_documents_read on storage.objects using(bucket_id='estudio-documents' and private.document_object_access(name,false));
alter policy estudio_documents_insert on storage.objects with check(bucket_id='estudio-documents' and private.document_object_access(name,true));
alter policy estudio_documents_cleanup on storage.objects using(bucket_id='estudio-documents' and private.document_object_access(name,true));
alter policy estudio_documents_limit_read on storage.objects using(bucket_id<>'estudio-documents' or private.document_object_access(name,false));
alter policy estudio_documents_limit_insert on storage.objects with check(bucket_id<>'estudio-documents' or private.document_object_access(name,true));
alter policy estudio_documents_limit_delete on storage.objects using(bucket_id<>'estudio-documents' or private.document_object_access(name,true));

do $$declare signature text;begin
 foreach signature in array array['save_studio_document(uuid,uuid,integer,jsonb)','prepare_studio_document(uuid,uuid,integer)','finalize_studio_document(uuid,uuid,text)'] loop
  execute 'revoke all on function public.'||signature||' from public';execute 'grant execute on function public.'||signature||' to authenticated';
 end loop;
end $$;

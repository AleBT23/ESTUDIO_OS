alter table public.studio_documents add column quote_version_id uuid,
 add foreign key(organization_id,quote_version_id) references public.quote_versions(organization_id,id);
create view public.document_quote_context with(security_invoker=true) as
select v.organization_id,v.id,v.quote_id,q.client_id,coalesce(p.id,c.project_id) project_id,
 v.folio,v.version_number,q.deleted_at,
 jsonb_build_object('folio',v.folio,'total_cents',v.snapshot->'quote'->'total_cents','advance_rate',v.snapshot->'quote'->>'advance_rate') context
from public.quote_versions v join public.quotes q on q.organization_id=v.organization_id and q.id=v.quote_id
left join public.projects p on p.organization_id=q.organization_id and p.quote_version_id=q.issued_version_id
left join public.scope_changes c on c.organization_id=q.organization_id and c.quote_id=q.id
where v.state='issued' and private.has_role(v.organization_id,array['owner','admin']::public.member_role[]);
revoke all on public.document_quote_context from public,anon,authenticated;
grant select on public.document_quote_context to authenticated;
create or replace function public.save_studio_document(org uuid,document uuid,expected_version integer,header jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid;client uuid:=nullif(header->>'client_id','')::uuid;project uuid:=nullif(header->>'project_id','')::uuid;project_client uuid; quote_ref uuid:=nullif(header->>'quote_version_id','')::uuid; previous_ref uuid; selected public.document_quote_context;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 if document is not null then
   select d.quote_version_id into previous_ref from public.studio_documents d where d.organization_id=org and d.id=document and d.version=expected_version and d.deleted_at is null for update;
   if not found then raise exception 'Conflicto de edición'; end if;
   if not (header ? 'quote_version_id') then quote_ref:=previous_ref;end if;
 end if;
 if quote_ref is not null then
   select * into selected from public.document_quote_context v where v.organization_id=org and v.id=quote_ref;
   if selected.id is null or (selected.deleted_at is not null and previous_ref is distinct from quote_ref) then raise exception 'Versión de cotización no disponible'; end if;
   if (client is not null and client<>selected.client_id) or (project is not null and project is distinct from selected.project_id) then raise exception 'La cotización no corresponde al expediente'; end if;
   client:=selected.client_id;
 end if;
 if project is not null then
  select client_id into project_client from public.projects where organization_id=org and id=project and deleted_at is null;
  if project_client is null then raise exception 'Proyecto no disponible';end if;
  if client is not null and client<>project_client then raise exception 'El proyecto pertenece a otro cliente';end if;
  client:=project_client;
 end if;
 if client is not null and not exists(select 1 from public.clients where organization_id=org and id=client and deleted_at is null) then raise exception 'Cliente no disponible';end if;
 if not coalesce((header->'margins'->>'top')::numeric between 22 and 60 and (header->'margins'->>'bottom')::numeric between 26 and 60 and (header->'margins'->>'left')::numeric between 12 and 45 and (header->'margins'->>'right')::numeric between 24 and 50,false) then raise exception 'Márgenes inválidos';end if;
 if document is null then
  insert into public.studio_documents(organization_id,client_id,project_id,title,kind,body,margins,quote_version_id) values(org,client,project,trim(header->>'title'),header->>'kind',header->>'body',header->'margins',quote_ref) returning id into target;
 else
  update public.studio_documents set client_id=client,project_id=project,quote_version_id=quote_ref,title=trim(header->>'title'),kind=header->>'kind',body=header->>'body',margins=header->'margins'
  where organization_id=org and id=document and version=expected_version and deleted_at is null returning id into target;
  if target is null then raise exception 'Conflicto de edición';end if;
 end if;
 return target;
end $$;
create or replace function public.prepare_studio_document(org uuid,document uuid,expected_version integer) returns jsonb
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
 if d.quote_version_id is not null then
   snap:=snap||jsonb_build_object('quote',(select context from public.document_quote_context where organization_id=org and id=d.quote_version_id));
 end if;
 insert into public.generated_documents(id,organization_id,document_id,draft_version,folio,snapshot,storage_path) values(target,org,document,expected_version,folio,snap,org::text||'/documents/'||target::text||'.pdf') returning * into v;
 return jsonb_build_object('id',v.id,'snapshot',v.snapshot,'storage_path',v.storage_path,'state',v.state);
end $$;

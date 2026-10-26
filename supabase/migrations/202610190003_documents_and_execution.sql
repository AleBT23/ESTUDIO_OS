create table public.folio_counters(organization_id uuid not null references public.organizations(id),year integer not null,last_value integer not null,primary key(organization_id,year));
create table public.quote_versions(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),quote_id uuid not null,
 draft_version integer not null,version_number integer not null,folio text not null,snapshot jsonb not null,
 storage_path text not null unique,state text not null default 'prepared' check(state in ('prepared','issued')),
 sha256 text check(sha256~'^[a-f0-9]{64}$'), issued_at timestamptz,
 created_at timestamptz not null default now(),
 unique(organization_id,id),unique(organization_id,folio),unique(quote_id,draft_version),unique(quote_id,version_number),
 foreign key(organization_id,quote_id) references public.quotes(organization_id,id),
 check(state<>'issued' or (sha256 is not null and issued_at is not null))
);
alter table public.quotes add column issued_version_id uuid;
alter table public.quotes add constraint quote_issued_version foreign key(organization_id,issued_version_id) references public.quote_versions(organization_id,id);
create table public.quote_status_events(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),quote_id uuid not null,actor_id uuid references auth.users(id),status text not null,created_at timestamptz not null default now(),foreign key(organization_id,quote_id) references public.quotes(organization_id,id));
create table public.projects(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),client_id uuid not null,quote_version_id uuid not null,
 name text not null,state text not null default 'active' check(state in ('active','paused','closed','archived')),
 location text not null default '',start_date date not null,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),unique(quote_version_id),
 foreign key(organization_id,client_id) references public.clients(organization_id,id),foreign key(organization_id,quote_version_id) references public.quote_versions(organization_id,id)
);
create index projects_state on public.projects(organization_id,state);
create table public.project_service_packages(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),project_id uuid not null,business_line_id uuid not null,
 name text not null,scope jsonb not null,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),foreign key(organization_id,project_id) references public.projects(organization_id,id),foreign key(organization_id,business_line_id) references public.business_lines(organization_id,id)
);
create index packages_project on public.project_service_packages(organization_id,project_id,business_line_id);
create table public.package_financials(
 organization_id uuid not null references public.organizations(id),package_id uuid primary key,
 contracted_net_cents bigint not null check(contracted_net_cents>=0),currency text not null default 'MXN' check(currency='MXN'),
 foreign key(organization_id,package_id) references public.project_service_packages(organization_id,id)
);
create table public.payment_schedules(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),project_id uuid not null,
 label text not null,amount_cents bigint not null check(amount_cents>0),due_date date not null,currency text not null default 'MXN' check(currency='MXN'),
 created_at timestamptz not null default now(),unique(organization_id,id),foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create index schedules_due on public.payment_schedules(organization_id,due_date);
create table public.payments(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),schedule_id uuid not null,
 amount_cents bigint not null check(amount_cents>0),paid_on date not null,reference text not null default '' check(char_length(reference)<=200),
 state text not null default 'posted' check(state in ('posted','reversed')),idempotency_key uuid not null,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),unique(organization_id,idempotency_key),foreign key(organization_id,schedule_id) references public.payment_schedules(organization_id,id)
);
do $$declare tbl text;begin
 foreach tbl in array array['quote_versions','quote_status_events','projects','project_service_packages','package_financials','payment_schedules','payments','folio_counters'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);
  if tbl<>'folio_counters' then
   execute format('grant select on public.%I to authenticated',tbl);
   if tbl in ('projects','project_service_packages') then
    execute format('create policy organization_read on public.%I for select to authenticated using(private.has_role(organization_id,array[''owner'',''admin'',''collaborator'',''reader'']::public.member_role[]))',tbl);
   else
    execute format('create policy finance_read on public.%I for select to authenticated using(private.has_role(organization_id,array[''owner'',''admin'']::public.member_role[]))',tbl);
   end if;
  end if;
 end loop;
 foreach tbl in array array['projects','project_service_packages','payments'] loop
  execute format('create trigger %I before insert or update on public.%I for each row execute function private.track_change()',tbl||'_track',tbl);
 end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('estudio-documents','estudio-documents',false,20971520,array['application/pdf']) on conflict(id) do nothing;
do $$begin
 if exists(select 1 from storage.buckets where id='estudio-documents' and public=true) then raise exception 'El bucket existente es público. Revisar y respaldar antes de configurar documentos privados';end if;
end $$;
create policy estudio_documents_anon_block on storage.objects as restrictive for all to anon using(bucket_id<>'estudio-documents') with check(bucket_id<>'estudio-documents');
create policy estudio_documents_read on storage.objects for select to authenticated using(bucket_id='estudio-documents' and exists(select 1 from public.quote_versions v where v.storage_path=name and private.has_role(v.organization_id,array['owner','admin']::public.member_role[])));
create policy estudio_documents_insert on storage.objects for insert to authenticated with check(bucket_id='estudio-documents' and exists(select 1 from public.quote_versions v where v.storage_path=name and v.state='prepared' and private.has_role(v.organization_id,array['owner','admin']::public.member_role[])));
create policy estudio_documents_cleanup on storage.objects for delete to authenticated using(bucket_id='estudio-documents' and exists(select 1 from public.quote_versions v where v.storage_path=name and v.state='prepared' and private.has_role(v.organization_id,array['owner','admin']::public.member_role[])));
-- Restrictivas: otras políticas de Storage no deben permitir mutar PDFs emitidos.
create policy estudio_documents_no_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'estudio-documents') with check(bucket_id<>'estudio-documents');
create policy estudio_documents_limit_read on storage.objects as restrictive for select to authenticated using(bucket_id<>'estudio-documents' or exists(select 1 from public.quote_versions v where v.storage_path=name and private.has_role(v.organization_id,array['owner','admin']::public.member_role[])));
create policy estudio_documents_limit_insert on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'estudio-documents' or exists(select 1 from public.quote_versions v where v.storage_path=name and v.state='prepared' and private.has_role(v.organization_id,array['owner','admin']::public.member_role[])));
create policy estudio_documents_limit_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'estudio-documents' or exists(select 1 from public.quote_versions v where v.storage_path=name and v.state='prepared' and private.has_role(v.organization_id,array['owner','admin']::public.member_role[])));

create function public.prepare_quote_version(org uuid,quote uuid,expected_version integer,options jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.quotes;v public.quote_versions;seq integer;yr integer;folio text;target uuid:=gen_random_uuid();snap jsonb;client jsonb;organization jsonb;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select * into q from public.quotes where organization_id=org and id=quote and version=expected_version and status='draft' and deleted_at is null for update;
 if q.id is null then raise exception 'Conflicto de edición o estado';end if;
 if not (options->'sections' @> '["budget"]'::jsonb) then raise exception 'Presupuesto obligatorio';end if;
 select * into v from public.quote_versions where quote_id=quote and draft_version=expected_version;
 if v.id is not null then
  if (v.snapshot->'options') is distinct from options then raise exception 'La preparación anterior usa otras opciones; guarda una nueva edición';end if;
  return jsonb_build_object('id',v.id,'snapshot',v.snapshot,'storage_path',v.storage_path,'state',v.state);
 end if;
 if not exists(select 1 from public.quote_items where quote_id=quote and organization_id=org) then raise exception 'Sin partidas';end if;
 select jsonb_build_object('name',name,'email',email,'phone',phone,'address',address) into client from public.clients where organization_id=org and id=q.client_id;
 select jsonb_build_object('name',name),extract(year from now() at time zone timezone)::integer into organization,yr from public.organizations where id=org;
 insert into public.folio_counters(organization_id,year,last_value) values(org,yr,1) on conflict(organization_id,year) do update set last_value=public.folio_counters.last_value+1 returning last_value into seq;
 folio:='COT-'||yr::text||'-'||lpad(seq::text,greatest(4,char_length(seq::text)),'0');
 snap:=jsonb_build_object('folio',folio,'issued_at',now(),'organization',organization,'client',client,
  'quote',jsonb_build_object('name',q.name,'currency',q.currency,'vat_rate',q.vat_rate,'apply_vat',q.apply_vat,'advance_rate',q.advance_rate,'valid_until',q.valid_until,'notes',q.notes,'conditions',q.conditions,'subtotal_cents',q.subtotal_cents,'discount_cents',q.discount_cents,'tax_cents',q.tax_cents,'total_cents',q.total_cents),
  'items',(select jsonb_agg(jsonb_build_object('name',i.name,'description',i.description,'quantity',i.quantity,'unit',i.unit,'unit_price_cents',i.unit_price_cents,'discount_rate',i.discount_rate,'business_line_id',i.business_line_id) order by i.position) from public.quote_items i where i.organization_id=org and i.quote_id=quote),'options',options);
 insert into public.quote_versions(id,organization_id,quote_id,draft_version,version_number,folio,snapshot,storage_path)
 values(target,org,quote,expected_version,(select coalesce(max(version_number),0)+1 from public.quote_versions where quote_id=quote),folio,snap,org::text||'/'||target::text||'.pdf') returning * into v;
 return jsonb_build_object('id',v.id,'snapshot',v.snapshot,'storage_path',v.storage_path,'state',v.state);
end $$;
create function public.finalize_quote_version(org uuid,version_id uuid,checksum text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.quote_versions;q public.quotes;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select * into v from public.quote_versions where organization_id=org and id=version_id;
 if v.id is null then raise exception 'Versión no encontrada';end if;
 select * into q from public.quotes where id=v.quote_id and organization_id=org for update;
 select * into v from public.quote_versions where organization_id=org and id=version_id for update;
 if v.state='issued' then
  if v.sha256 is distinct from checksum then raise exception 'La versión ya emitida tiene otra huella';end if;
  return;
 end if;
 if q.status<>'draft' or q.version<>v.draft_version then raise exception 'El borrador cambió';end if;
 if not exists(select 1 from storage.objects where bucket_id='estudio-documents' and name=v.storage_path) then raise exception 'PDF no almacenado';end if;
 update public.quote_versions set state='issued',sha256=checksum,issued_at=clock_timestamp() where id=version_id and organization_id=org;
 insert into public.audit_events(organization_id,actor_id,entity_type,entity_id,action) values(org,auth.uid(),'quote_versions',version_id,'issued');
end $$;
create function public.mark_quote_sent(org uuid,quote uuid,expected_version integer,version_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.quotes;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select * into q from public.quotes where organization_id=org and id=quote and version=expected_version and status='draft' for update;
 if q.id is null then raise exception 'Conflicto de edición o estado';end if;
 if not exists(select 1 from public.quote_versions where organization_id=org and quote_id=quote and id=version_id and draft_version=q.version and state='issued') then raise exception 'Emite la versión vigente primero';end if;
 update public.quotes set status='sent',issued_version_id=version_id where organization_id=org and id=quote;
 insert into public.quote_status_events(organization_id,quote_id,actor_id,status) values(org,quote,auth.uid(),'sent');
end $$;
create function public.accept_quote(org uuid,quote uuid,expected_version integer,advance_due date,balance_due date) returns uuid
language plpgsql security definer set search_path='' as $$
declare q public.quotes;v public.quote_versions;project uuid;pkg uuid;line uuid;advance bigint;net bigint;items jsonb;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select * into q from public.quotes where organization_id=org and id=quote and version=expected_version and status='sent' for update;
 if q.id is null then raise exception 'Conflicto de edición o estado';end if;
 if advance_due is null or balance_due is null or balance_due<advance_due then raise exception 'Fechas de cobro inválidas';end if;
 if q.valid_until<(now() at time zone (select timezone from public.organizations where id=org))::date then raise exception 'La propuesta venció; emite una nueva versión';end if;
 select * into v from public.quote_versions where organization_id=org and id=q.issued_version_id and state='issued';
 if v.id is null then raise exception 'Versión emitida no disponible';end if;
 insert into public.projects(organization_id,client_id,quote_version_id,name,start_date) values(org,q.client_id,v.id,q.name,advance_due) returning id into project;
 for line in select distinct (value->>'business_line_id')::uuid from jsonb_array_elements(v.snapshot->'items') loop
  select jsonb_agg(jsonb_build_object('name',value->>'name','description',value->>'description','quantity',value->>'quantity','unit',value->>'unit')),
   sum(round((value->>'quantity')::numeric*(value->>'unit_price_cents')::numeric/case when value->>'unit'='pct' then 100 else 1 end)-round(round((value->>'quantity')::numeric*(value->>'unit_price_cents')::numeric/case when value->>'unit'='pct' then 100 else 1 end)*(value->>'discount_rate')::numeric/100))::bigint
  into items,net from jsonb_array_elements(v.snapshot->'items') where (value->>'business_line_id')::uuid=line;
  insert into public.project_service_packages(organization_id,project_id,business_line_id,name,scope) values(org,project,line,(select name from public.business_lines where id=line and organization_id=org),items) returning id into pkg;
  insert into public.package_financials(organization_id,package_id,contracted_net_cents) values(org,pkg,net);
 end loop;
 advance:=round(q.total_cents*q.advance_rate/100);
 if advance>0 then insert into public.payment_schedules(organization_id,project_id,label,amount_cents,due_date) values(org,project,'Anticipo',advance,advance_due);end if;
 if q.total_cents-advance>0 then insert into public.payment_schedules(organization_id,project_id,label,amount_cents,due_date) values(org,project,'Saldo',q.total_cents-advance,balance_due);end if;
 update public.quotes set status='accepted' where organization_id=org and id=quote;
 insert into public.quote_status_events(organization_id,quote_id,actor_id,status) values(org,quote,auth.uid(),'accepted');
 return project;
end $$;
create function public.record_payment(org uuid,schedule uuid,amount bigint,payment_date date,payment_reference text,request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare due public.payment_schedules;collected bigint;target uuid;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select * into due from public.payment_schedules where organization_id=org and id=schedule for update;
 if due.id is null then raise exception 'Plan no disponible';end if;
 select id into target from public.payments where organization_id=org and idempotency_key=request_id;
 if target is not null then
  if not exists(select 1 from public.payments where id=target and schedule_id=schedule and amount_cents=amount and paid_on=payment_date and reference=payment_reference) then raise exception 'La clave de operación corresponde a otro movimiento';end if;
  return target;
 end if;
 if payment_date is null or payment_date>(now() at time zone (select timezone from public.organizations where id=org))::date then raise exception 'Fecha de pago inválida';end if;
 select coalesce(sum(amount_cents),0) into collected from public.payments where organization_id=org and schedule_id=schedule and state='posted';
 if amount<=0 or amount>due.amount_cents-collected then raise exception 'El importe supera el saldo pendiente o no es positivo';end if;
 insert into public.payments(organization_id,schedule_id,amount_cents,paid_on,reference,idempotency_key) values(org,schedule,amount,payment_date,payment_reference,request_id) returning id into target;
 return target;
end $$;
do $$declare signature text;begin
 foreach signature in array array['prepare_quote_version(uuid,uuid,integer,jsonb)','finalize_quote_version(uuid,uuid,text)','mark_quote_sent(uuid,uuid,integer,uuid)','accept_quote(uuid,uuid,integer,date,date)','record_payment(uuid,uuid,bigint,date,text,uuid)'] loop
  execute 'revoke all on function public.'||signature||' from public';execute 'grant execute on function public.'||signature||' to authenticated';
 end loop;
end $$;

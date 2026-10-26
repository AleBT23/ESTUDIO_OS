create table public.services (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 business_line_id uuid not null, code text not null check(char_length(code) between 1 and 40),
 category text not null default '' check(char_length(category)<=100), name text not null check(char_length(name) between 2 and 160),
 unit text not null check(unit in ('m2','unit','hour','visit','fixed','pct')),
 price_cents bigint not null check(price_cents between 0 and 99999999999999),
 estimated_cost_cents bigint not null default 0 check(estimated_cost_cents between 0 and 99999999999999),
 description text not null default '' check(char_length(description)<=10000), valid_until date, legacy_id text,
 version integer not null default 1, created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),unique(organization_id,code),unique(organization_id,legacy_id),
 foreign key(organization_id,business_line_id) references public.business_lines(organization_id,id),
 check(unit<>'pct' or price_cents<=10000)
);
create index services_line on public.services(organization_id,business_line_id,deleted_at);
create table public.concepts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(char_length(name) between 2 and 160), body text not null check(char_length(body) between 1 and 10000),
 legacy_id text, version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),unique(organization_id,legacy_id)
);
create table public.service_presets (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(char_length(name) between 2 and 160), notes text not null default '' check(char_length(notes)<=10000),
 legacy_id text, version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),unique(organization_id,legacy_id)
);
create table public.preset_items (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 preset_id uuid not null,service_id uuid not null,quantity numeric(16,4) not null default 1 check(quantity>0),
 position integer not null check(position>=0),
 foreign key(organization_id,preset_id) references public.service_presets(organization_id,id),
 foreign key(organization_id,service_id) references public.services(organization_id,id),
 unique(preset_id,position)
);
create table public.quotes (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), client_id uuid not null,
 name text not null check(char_length(name) between 2 and 160), status text not null default 'draft' check(status in ('draft','sent','accepted','rejected','expired')),
 currency text not null default 'MXN' check(currency='MXN'), vat_rate numeric(7,4) not null check(vat_rate between 0 and 100), apply_vat boolean not null default false,
 advance_rate numeric(7,4) not null default 50 check(advance_rate between 0 and 100), valid_until date not null,
 notes text not null default '' check(char_length(notes)<=10000), conditions text not null default '' check(char_length(conditions)<=20000),
 estimated_hours numeric(16,4) not null default 0 check(estimated_hours>=0), external_cost_cents bigint not null default 0 check(external_cost_cents between 0 and 99999999999999),
 subtotal_cents bigint not null default 0,discount_cents bigint not null default 0,tax_cents bigint not null default 0,total_cents bigint not null default 0,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),foreign key(organization_id,client_id) references public.clients(organization_id,id)
);
create index quotes_client on public.quotes(organization_id,client_id,status);
create table public.quote_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), quote_id uuid not null,
 business_line_id uuid not null, service_id uuid, name text not null check(char_length(name) between 2 and 160), description text not null default '' check(char_length(description)<=10000),
 quantity numeric(16,4) not null check(quantity>0),unit text not null check(unit in ('m2','unit','hour','visit','fixed','pct')),
 unit_price_cents bigint not null check(unit_price_cents between 0 and 99999999999999),discount_rate numeric(7,4) not null check(discount_rate between 0 and 100),
 position integer not null check(position>=0),
 foreign key(organization_id,quote_id) references public.quotes(organization_id,id),
 foreign key(organization_id,business_line_id) references public.business_lines(organization_id,id),
 foreign key(organization_id,service_id) references public.services(organization_id,id),
 unique(quote_id,position),check(unit<>'pct' or unit_price_cents<=10000)
);
create index quote_items_line on public.quote_items(organization_id,business_line_id,quote_id);

do $$declare tbl text;begin
 foreach tbl in array array['services','concepts','service_presets','quotes'] loop
  execute format('create trigger %I before insert or update on public.%I for each row execute function private.track_change()',tbl||'_track',tbl);
 end loop;
 foreach tbl in array array['services','concepts','service_presets','preset_items','quotes','quote_items'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public,anon,authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  -- Propuestas y costos comerciales restringidos a administración.
  execute format('create policy commercial_read on public.%I for select to authenticated using(private.has_role(organization_id,array[''owner'',''admin'']::public.member_role[]))',tbl);
 end loop;
 foreach tbl in array array['services','concepts'] loop
  execute format('grant insert on public.%I to authenticated',tbl);
  execute format('create policy commercial_insert on public.%I for insert to authenticated with check(private.has_role(organization_id,array[''owner'',''admin'']::public.member_role[]))',tbl);
  execute format('create policy commercial_update on public.%I for update to authenticated using(private.has_role(organization_id,array[''owner'',''admin'']::public.member_role[])) with check(private.has_role(organization_id,array[''owner'',''admin'']::public.member_role[]))',tbl);
 end loop;
end $$;
grant update(business_line_id,code,category,name,unit,price_cents,estimated_cost_cents,description,valid_until,deleted_at) on public.services to authenticated;
grant update(name,body,deleted_at) on public.concepts to authenticated;

create function public.save_preset(org uuid,preset uuid,expected_version integer,preset_name text,preset_notes text,items jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid; item jsonb; idx integer:=0;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 100 then raise exception 'Selecciona entre 1 y 100 servicios';end if;
 if preset is null then insert into public.service_presets(organization_id,name,notes) values(org,trim(preset_name),preset_notes) returning id into target;
 else
  update public.service_presets set name=trim(preset_name),notes=preset_notes where organization_id=org and id=preset and version=expected_version and deleted_at is null returning id into target;
  if target is null then raise exception 'Conflicto de edición';end if;
  delete from public.preset_items where organization_id=org and preset_id=target;
 end if;
 for item in select value from jsonb_array_elements(items) loop
  if not exists(select 1 from public.services where organization_id=org and id=(item->>'service_id')::uuid and deleted_at is null) then raise exception 'Servicio no disponible';end if;
  insert into public.preset_items(organization_id,preset_id,service_id,quantity,position) values(org,target,(item->>'service_id')::uuid,(item->>'quantity')::numeric,idx);idx:=idx+1;
 end loop;
 return target;
end $$;
revoke all on function public.save_preset(uuid,uuid,integer,text,text,jsonb) from public;
grant execute on function public.save_preset(uuid,uuid,integer,text,text,jsonb) to authenticated;

create function public.save_quote_draft(org uuid,quote uuid,expected_version integer,header jsonb,items jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare target uuid;item jsonb;idx integer:=0;base bigint;disc bigint;sub bigint:=0;discount bigint:=0;tax bigint;rate numeric;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 100 then raise exception 'Agrega entre 1 y 100 partidas';end if;
 if (header->>'vat_rate')::numeric<>round((header->>'vat_rate')::numeric,4) or (header->>'advance_rate')::numeric<>round((header->>'advance_rate')::numeric,4) then raise exception 'Precisión de porcentaje inválida';end if;
 if not exists(select 1 from public.clients where organization_id=org and id=(header->>'client_id')::uuid and deleted_at is null) then raise exception 'Cliente no disponible';end if;
 if quote is null then
  insert into public.quotes(organization_id,client_id,name,vat_rate,apply_vat,advance_rate,valid_until,notes,conditions,estimated_hours,external_cost_cents)
  values(org,(header->>'client_id')::uuid,trim(header->>'name'),(header->>'vat_rate')::numeric,(header->>'apply_vat')::boolean,(header->>'advance_rate')::numeric,(header->>'valid_until')::date,coalesce(header->>'notes',''),coalesce(header->>'conditions',''),coalesce((header->>'estimated_hours')::numeric,0),coalesce((header->>'external_cost_cents')::bigint,0)) returning id into target;
 else
  select id into target from public.quotes where organization_id=org and id=quote and version=expected_version and status='draft' and deleted_at is null for update;
  if target is null then raise exception 'Conflicto de edición o propuesta emitida';end if;
  -- La actualización única de cabecera ocurre al final, para incrementar versión una sola vez.
  delete from public.quote_items where organization_id=org and quote_id=target;
 end if;
 for item in select value from jsonb_array_elements(items) loop
  if (item->>'quantity')::numeric<>round((item->>'quantity')::numeric,4) or (item->>'discount_rate')::numeric<>round((item->>'discount_rate')::numeric,4) or (item->>'unit_price_cents')::numeric<>round((item->>'unit_price_cents')::numeric) then raise exception 'Precisión de importe inválida';end if;
  insert into public.quote_items(organization_id,quote_id,business_line_id,service_id,name,description,quantity,unit,unit_price_cents,discount_rate,position)
  values(org,target,(item->>'business_line_id')::uuid,nullif(item->>'service_id','')::uuid,trim(item->>'name'),coalesce(item->>'description',''),(item->>'quantity')::numeric,item->>'unit',(item->>'unit_price_cents')::bigint,(item->>'discount_rate')::numeric,idx);
  base:=round((item->>'quantity')::numeric*(item->>'unit_price_cents')::numeric/case when item->>'unit'='pct' then 100 else 1 end);
  disc:=round(base*(item->>'discount_rate')::numeric/100); sub:=sub+base;discount:=discount+disc;idx:=idx+1;
 end loop;
 rate:=(header->>'vat_rate')::numeric;
 tax:=case when (header->>'apply_vat')::boolean then round((sub-discount)*rate/100) else 0 end;
 if sub+tax>9007199254740991 then raise exception 'Importe fuera de rango';end if;
 update public.quotes set client_id=(header->>'client_id')::uuid,name=trim(header->>'name'),vat_rate=rate,apply_vat=(header->>'apply_vat')::boolean,
  advance_rate=(header->>'advance_rate')::numeric,valid_until=(header->>'valid_until')::date,notes=coalesce(header->>'notes',''),conditions=coalesce(header->>'conditions',''),
  estimated_hours=coalesce((header->>'estimated_hours')::numeric,0),external_cost_cents=coalesce((header->>'external_cost_cents')::bigint,0),subtotal_cents=sub,discount_cents=discount,tax_cents=tax,total_cents=sub-discount+tax
 where id=target and organization_id=org;
 return target;
end $$;
revoke all on function public.save_quote_draft(uuid,uuid,integer,jsonb,jsonb) from public;
grant execute on function public.save_quote_draft(uuid,uuid,integer,jsonb,jsonb) to authenticated;

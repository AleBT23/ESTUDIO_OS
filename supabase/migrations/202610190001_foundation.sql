-- Migración aditiva. Aplicar una sola vez mediante scripts/migrate.mjs.
create schema if not exists private;
revoke all on schema private from public;
create type public.member_role as enum ('owner','admin','collaborator','reader');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  timezone text not null default 'America/Mexico_City',
  currency text not null default 'MXN' check(currency = 'MXN'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.memberships (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role public.member_role not null default 'reader',
  created_at timestamptz not null default now(),
  primary key (organization_id,user_id)
);
create table public.business_lines (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null check(char_length(name) between 2 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id,id), unique (organization_id,name)
);
create table public.clients (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  kind text not null default 'person' check(kind in ('person','company')),
  name text not null check(char_length(name) between 2 and 160),
  email text not null default '' check(char_length(email)<=254),
  phone text not null default '' check(char_length(phone)<=40),
  address text not null default '' check(char_length(address)<=500),
  source text not null default '' check(char_length(source)<=120),
  notes text not null default '' check(char_length(notes)<=10000),
  business_line_id uuid, legacy_id text,
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique(organization_id,id), unique(organization_id,legacy_id),
  foreign key(organization_id,business_line_id) references public.business_lines(organization_id,id)
);
create index clients_org_name on public.clients(organization_id,lower(name));
create index clients_line on public.clients(organization_id,business_line_id,deleted_at);
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  client_id uuid not null, name text not null check(char_length(name) between 2 and 160),
  email text not null default '', phone text not null default '', position text not null default '',
  version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  foreign key(organization_id,client_id) references public.clients(organization_id,id)
);
create index contacts_client on public.client_contacts(organization_id,client_id);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  actor_id uuid references auth.users(id), entity_type text not null, entity_id uuid not null,
  action text not null, created_at timestamptz not null default now()
);
create index audit_org_date on public.audit_events(organization_id,created_at desc);

create function private.has_role(org uuid, allowed public.member_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid() and m.role=any(allowed));
$$;
revoke all on function private.has_role(uuid,public.member_role[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_role(uuid,public.member_role[]) to authenticated;

create function private.track_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP='UPDATE' then
    new.version := old.version+1;
    new.updated_at := clock_timestamp();
  end if;
  insert into public.audit_events(organization_id,actor_id,entity_type,entity_id,action)
  values(new.organization_id,auth.uid(),TG_TABLE_NAME,new.id,
    case when TG_OP='INSERT' then 'created'
      when old.deleted_at is null and new.deleted_at is not null then 'archived'
      when old.deleted_at is not null and new.deleted_at is null then 'restored'
      else 'updated' end);
  return new;
end $$;
create trigger clients_track before insert or update on public.clients for each row execute function private.track_change();
create trigger contacts_track before insert or update on public.client_contacts for each row execute function private.track_change();

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.business_lines enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.audit_events enable row level security;
create policy organization_read on public.organizations for select to authenticated using(private.has_role(id,array['owner','admin','collaborator','reader']::public.member_role[]));
create policy membership_read on public.memberships for select to authenticated using(user_id=auth.uid());
create policy lines_read on public.business_lines for select to authenticated using(private.has_role(organization_id,array['owner','admin','collaborator','reader']::public.member_role[]));
create policy clients_read on public.clients for select to authenticated using(private.has_role(organization_id,array['owner','admin','collaborator','reader']::public.member_role[]));
create policy clients_insert on public.clients for insert to authenticated with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy clients_update on public.clients for update to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[])) with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy contacts_read on public.client_contacts for select to authenticated using(private.has_role(organization_id,array['owner','admin','collaborator','reader']::public.member_role[]));
create policy contacts_insert on public.client_contacts for insert to authenticated with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy contacts_update on public.client_contacts for update to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[])) with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy audit_read on public.audit_events for select to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
-- Supabase puede asignar privilegios por defecto: revocarlos explícitamente.
revoke all on public.organizations,public.memberships,public.business_lines,public.clients,public.client_contacts,public.audit_events from public,anon,authenticated;
grant select on public.organizations, public.memberships, public.business_lines, public.audit_events to authenticated;
grant select,insert on public.clients,public.client_contacts to authenticated;
grant update(kind,name,email,phone,address,source,notes,business_line_id,deleted_at) on public.clients to authenticated;
grant update(name,email,phone,position,deleted_at) on public.client_contacts to authenticated;

create function public.create_workspace(workspace_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare org uuid;
begin
  if auth.uid() is null then raise exception 'Se requiere iniciar sesión'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  if exists(select 1 from public.memberships where user_id=auth.uid()) then raise exception 'Ya perteneces a un estudio'; end if;
  insert into public.organizations(name) values(trim(workspace_name)) returning id into org;
  insert into public.memberships(organization_id,user_id,role) values(org,auth.uid(),'owner');
  insert into public.business_lines(organization_id,name) values(org,'Arquitectura'),(org,'Visualización');
  return org;
end $$;
revoke all on function public.create_workspace(text) from public;
grant execute on function public.create_workspace(text) to authenticated;

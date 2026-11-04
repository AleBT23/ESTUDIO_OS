create table public.client_portal_access(
 organization_id uuid not null, client_id uuid not null, user_id uuid not null references auth.users(id),
 enabled boolean not null default true, created_at timestamptz not null default now(),
 primary key(organization_id,client_id,user_id),
 foreign key(organization_id,client_id) references public.clients(organization_id,id)
);
create index portal_access_user on public.client_portal_access(user_id,organization_id,client_id) where enabled;
create table public.portal_deliveries(
 id uuid primary key, organization_id uuid not null,client_id uuid not null,project_id uuid not null,deliverable_id uuid not null,
 title text not null,project_name text not null,resource_url text not null check(length(resource_url)<=2000 and resource_url ~ '^https://[^[:space:]]+$'),
 visible boolean not null default true, created_at timestamptz not null default now(),created_by uuid not null default auth.uid() references auth.users(id),
 unique(deliverable_id),
 foreign key(organization_id,client_id,project_id) references public.projects(organization_id,client_id,id),
 foreign key(organization_id,project_id,deliverable_id) references public.project_deliverables(organization_id,project_id,id)
);
create function private.prepare_portal_delivery() returns trigger language plpgsql set search_path='' as $$
begin
 select d.name,p.name,p.client_id into strict new.title,new.project_name,new.client_id
 from public.deliverable_status d join public.projects p on p.organization_id=d.organization_id and p.id=d.project_id
 where d.id=new.deliverable_id and d.organization_id=new.organization_id and d.project_id=new.project_id and d.state='approved' and p.deleted_at is null;
 return new;
end $$;
revoke all on function private.prepare_portal_delivery() from public,anon,authenticated;
create trigger portal_prepare before insert on public.portal_deliveries for each row execute function private.prepare_portal_delivery();
create function private.client_portal_allowed(org uuid,client uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.client_portal_access a join public.clients c on c.organization_id=a.organization_id and c.id=a.client_id
 where a.organization_id=org and a.client_id=client and a.user_id=auth.uid() and a.enabled and c.deleted_at is null);
$$;
revoke all on function private.client_portal_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function private.client_portal_allowed(uuid,uuid) to authenticated;
do $$ declare tbl text;begin
 foreach tbl in array array['client_portal_access','portal_deliveries'] loop
 execute format('alter table public.%I enable row level security',tbl);
 execute format('revoke all on public.%I from public,anon,authenticated',tbl);
 execute format('grant select on public.%I to authenticated',tbl);
 execute format('create policy portal_manage on public.%I for all to authenticated using(private.has_role(organization_id,array[''owner'',''admin'']::public.member_role[])) with check(private.has_role(organization_id,array[''owner'',''admin'']::public.member_role[]))',tbl);
 end loop;
end $$;
create policy portal_delivery_read on public.portal_deliveries for select to authenticated using(visible and private.client_portal_allowed(organization_id,client_id));
grant insert(organization_id,client_id,user_id),update(enabled) on public.client_portal_access to authenticated;
grant insert(id,organization_id,project_id,deliverable_id,resource_url),update(visible) on public.portal_deliveries to authenticated;

create view public.my_portal_deliveries with(security_invoker=true) as
 select id,title,project_name,resource_url,created_at from public.portal_deliveries
 where visible and private.client_portal_allowed(organization_id,client_id);
revoke all on public.my_portal_deliveries from public,anon,authenticated;
grant select on public.my_portal_deliveries to authenticated;

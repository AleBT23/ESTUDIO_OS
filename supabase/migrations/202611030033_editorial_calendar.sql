create table public.editorial_items (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  title text not null check (length(trim(title)) between 2 and 160),
  channel text not null check (length(trim(channel)) between 1 and 80),
  status text not null check (status in ('idea','scheduled','published')),
  publication_on date,
  url text not null default '' check (url = '' or (length(url)<=2048 and url ~ '^https?://[^[:space:]]+$')),
  results text not null default '' check (length(results)<=4000),
  portfolio boolean not null default false,
  project_id uuid,
  opportunity_id uuid,
  version integer not null default 1,
  check (status = 'idea' or publication_on is not null),
  foreign key (organization_id,project_id) references public.projects(organization_id,id),
  foreign key (organization_id,opportunity_id) references public.opportunities(organization_id,id)
);
create index editorial_calendar on public.editorial_items(organization_id,publication_on);
alter table public.editorial_items enable row level security;
revoke all on public.editorial_items from public,anon,authenticated;
grant select on public.editorial_items to authenticated;
grant insert(id,organization_id,title,channel,status,publication_on,url,results,portfolio,project_id,opportunity_id),
 update(title,channel,status,publication_on,url,results,portfolio,project_id,opportunity_id) on public.editorial_items to authenticated;
create policy editorial_staff on public.editorial_items for all to authenticated
 using (private.has_role(organization_id,array['owner','admin']::public.member_role[]))
 with check (private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create function private.advance_editorial_version() returns trigger language plpgsql set search_path='' as $$
begin
  new.version := old.version + 1;
  return new;
end $$;
create trigger editorial_version before update on public.editorial_items
 for each row execute function private.advance_editorial_version();

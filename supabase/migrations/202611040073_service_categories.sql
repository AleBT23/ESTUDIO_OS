create table public.service_categories(
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(name) between 1 and 100),
  category_key text generated always as (lower(btrim(name))) stored,
  primary key (organization_id,category_key)
);
alter table public.service_categories enable row level security;
revoke all on public.service_categories from public,anon,authenticated;
grant select on public.service_categories to authenticated;
create policy categories_read on public.service_categories for select to authenticated
using (private.has_role(organization_id,array['owner','admin']::public.member_role[]));

insert into public.service_categories(organization_id,name)
select organization_id,min(btrim(category)) from public.services
where btrim(category) <> '' group by organization_id,lower(btrim(category));

alter table public.services add column category_key text generated always as (nullif(lower(btrim(category)),'')) stored,
add foreign key (organization_id,category_key) references public.service_categories(organization_id,category_key);
create index services_category on public.services(organization_id,category_key);

create function private.register_service_category() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if btrim(new.category) <> '' then
    insert into public.service_categories(organization_id,name) values(new.organization_id,btrim(new.category))
    on conflict(organization_id,category_key) do nothing;
  end if;
  return new;
end $$;
revoke all on function private.register_service_category() from public,anon,authenticated;
create trigger register_service_category before insert or update of category,organization_id
on public.services for each row execute function private.register_service_category();

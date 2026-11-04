create table public.work_resource_usage(
 id uuid primary key, organization_id uuid not null, work_id uuid not null,item_id uuid not null,
 category text not null check(category in ('material','labor','equipment')),
 description text not null check(length(trim(description)) between 2 and 200),
 used_on date not null, quantity numeric(12,4) not null check(quantity>0),unit text not null check(length(trim(unit)) between 1 and 30),
 supplier_id uuid,created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,work_id,item_id) references public.work_budget_items(organization_id,work_id,id),
 foreign key(organization_id,supplier_id) references public.suppliers(organization_id,id)
);
create index usage_history on public.work_resource_usage(organization_id,item_id,category,used_on desc,id);
alter table public.work_resource_usage enable row level security;
revoke all on public.work_resource_usage from public,anon,authenticated;
grant select on public.work_resource_usage to authenticated;
grant insert(id,organization_id,work_id,item_id,category,description,used_on,quantity,unit,supplier_id) on public.work_resource_usage to authenticated;
create policy usage_finance on public.work_resource_usage for all to authenticated
 using(private.has_role(organization_id,array['owner','admin']::public.member_role[]))
 with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));

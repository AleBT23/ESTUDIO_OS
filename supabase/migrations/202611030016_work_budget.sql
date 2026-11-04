create table public.work_budget_items (
 id uuid primary key, organization_id uuid not null, work_id uuid not null,
 chapter text not null check(length(trim(chapter)) between 1 and 100),
 description text not null check(length(trim(description)) between 2 and 300),
 unit text not null check(length(trim(unit)) between 1 and 25),
 quantity numeric(12,4) not null check(quantity>0),
 unit_price_cents bigint not null check(unit_price_cents between 0 and 999999999999),
 total_cents numeric generated always as (round(quantity*unit_price_cents)) stored,
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 foreign key(organization_id,work_id) references public.works(organization_id,id)
);
create index work_budget_order on public.work_budget_items(organization_id,work_id,chapter,id);
alter table public.work_budget_items enable row level security;
revoke all on public.work_budget_items from public,anon,authenticated;
grant select on public.work_budget_items to authenticated;
grant insert(id,organization_id,work_id,chapter,description,unit,quantity,unit_price_cents) on public.work_budget_items to authenticated;
create policy budget_access on public.work_budget_items for all to authenticated
 using(private.has_role(organization_id,array['owner','admin']::public.member_role[]))
 with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create view public.work_budget_totals with(security_invoker=true) as
select organization_id,work_id,sum(total_cents)::text base_cents
from public.work_budget_items group by organization_id,work_id;
revoke all on public.work_budget_totals from public,anon,authenticated;
grant select on public.work_budget_totals to authenticated;

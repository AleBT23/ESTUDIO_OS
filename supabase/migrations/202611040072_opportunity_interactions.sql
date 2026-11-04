create table public.opportunity_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  opportunity_id uuid not null,
  actor_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('call','meeting','email','note')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  foreign key (organization_id,opportunity_id) references public.opportunities(organization_id,id)
);
create index interactions_history on public.opportunity_interactions(organization_id,opportunity_id,created_at desc,id desc);
alter table public.opportunity_interactions enable row level security;
revoke all on public.opportunity_interactions from public,anon,authenticated;
grant select,insert(organization_id,opportunity_id,kind,body) on public.opportunity_interactions to authenticated;
create policy interactions_read on public.opportunity_interactions for select to authenticated
using (private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy interactions_add on public.opportunity_interactions for insert to authenticated
with check (actor_id=auth.uid() and exists(
  select 1 from public.opportunities o where o.id=opportunity_id
  and o.organization_id=opportunity_interactions.organization_id and o.deleted_at is null
));

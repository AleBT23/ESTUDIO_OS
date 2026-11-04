create table public.journal_entries(
 id uuid primary key,organization_id uuid not null references public.organizations(id),
 client_id uuid,work_id uuid,kind text not null,occurred_on date not null,
 body text not null check(length(trim(body)) between 1 and 6000),
 created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,client_id) references public.clients(organization_id,id),
 foreign key(organization_id,work_id) references public.works(organization_id,id),
 check((client_id is not null and work_id is null and kind in ('call','email','meeting','message')) or
 (work_id is not null and client_id is null and kind in ('visit','progress','incident','decision')))
);
create index journal_client on public.journal_entries(organization_id,client_id,occurred_on desc,id) where client_id is not null;
create index journal_work on public.journal_entries(organization_id,work_id,occurred_on desc,id) where work_id is not null;
alter table public.journal_entries enable row level security;
revoke all on public.journal_entries from public,anon,authenticated;
grant select on public.journal_entries to authenticated;
grant insert(id,organization_id,client_id,work_id,kind,occurred_on,body) on public.journal_entries to authenticated;
create policy journal_read on public.journal_entries for select to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy journal_add on public.journal_entries for insert to authenticated with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]) and
 (client_id is null or exists(select 1 from public.clients c where c.organization_id=journal_entries.organization_id and c.id=journal_entries.client_id and c.deleted_at is null)));

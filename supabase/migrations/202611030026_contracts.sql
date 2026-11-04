alter table public.projects add unique(organization_id,client_id,id);
create table public.contracts(
 id uuid primary key, organization_id uuid not null, client_id uuid not null, project_id uuid,
 reference text not null check(length(trim(reference)) between 1 and 100),
 title text not null check(length(trim(title)) between 2 and 180),
 signed_on date not null, scope text not null check(length(trim(scope)) between 1 and 12000),
 document_url text check(length(document_url)<=2000 and document_url ~ '^https://[^[:space:]]+$'),
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id),
 foreign key(organization_id,client_id) references public.clients(organization_id,id),
 foreign key(organization_id,client_id,project_id) references public.projects(organization_id,client_id,id)
);
create unique index contracts_reference on public.contracts(organization_id,lower(trim(reference)));
create index contracts_client on public.contracts(organization_id,client_id,signed_on desc,id);
create index contracts_project on public.contracts(organization_id,project_id,signed_on desc,id);
alter table public.contracts enable row level security;
revoke all on public.contracts from public,anon,authenticated;
grant select on public.contracts to authenticated;
grant insert(id,organization_id,client_id,project_id,reference,title,signed_on,scope,document_url) on public.contracts to authenticated;
create policy contracts_read on public.contracts for select to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy contracts_register on public.contracts for insert to authenticated with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]) and
 exists(select 1 from public.clients c where c.id=contracts.client_id and c.organization_id=contracts.organization_id and c.deleted_at is null)
 and (project_id is null or exists(select 1 from public.projects p where p.id=contracts.project_id and p.organization_id=contracts.organization_id and p.deleted_at is null)));

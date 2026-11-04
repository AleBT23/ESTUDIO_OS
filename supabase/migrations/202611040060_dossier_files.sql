create table public.dossier_files (
 id uuid primary key,organization_id uuid not null,
 client_id uuid,project_id uuid,
 title text not null check(length(trim(title)) between 2 and 160),
 url text not null default '' check(url='' or (length(url)<=2048 and url ~ '^https?://[^[:space:]]+$')),
 filename text not null default '' check(length(filename)<=200),
 attachment bytea,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 version integer not null default 1,deleted_at timestamptz,
 check(num_nonnulls(client_id,project_id)=1),
 check(attachment is not null or url<>''),
 check((attachment is null and filename='') or (attachment is not null and filename<>'' and octet_length(attachment) between 1 and 2097152)),
 foreign key(organization_id,client_id) references public.clients(organization_id,id),
 foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create index dossier_client on public.dossier_files(organization_id,client_id,created_at desc,id) where client_id is not null;
create index dossier_project on public.dossier_files(organization_id,project_id,created_at desc,id) where project_id is not null;
alter table public.dossier_files enable row level security;
revoke all on public.dossier_files from public,anon,authenticated;
grant select,insert(id,organization_id,client_id,project_id,title,url,filename,attachment),update(deleted_at) on public.dossier_files to authenticated;
create policy dossier_read on public.dossier_files for select to authenticated using(
 private.has_role(organization_id,array['owner','admin']::public.member_role[])
 or (project_id is not null and private.has_role(organization_id,array['collaborator','reader']::public.member_role[])));
create policy dossier_add on public.dossier_files for insert to authenticated with check(
 (client_id is not null and private.has_role(organization_id,array['owner','admin']::public.member_role[])
 and exists(select 1 from public.clients c where c.id=dossier_files.client_id and c.organization_id=dossier_files.organization_id and c.deleted_at is null))
 or (project_id is not null and private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[])
 and exists(select 1 from public.projects p where p.id=dossier_files.project_id and p.organization_id=dossier_files.organization_id and p.deleted_at is null and p.state<>'archived')));
create policy dossier_archive on public.dossier_files for update to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]))
 with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create trigger dossier_track before insert or update on public.dossier_files for each row execute function private.track_change();

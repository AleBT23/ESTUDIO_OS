create table public.library_revisions (
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 resource_id uuid not null, version integer not null check(version>0),
 title text not null check(length(trim(title)) between 2 and 160),
 tags text not null default '' check(length(tags)<=300),
 notes text not null default '' check(length(notes)<=8000),
 url text not null default '' check(url='' or (length(url)<=2048 and url ~ '^https?://[^[:space:]]+$')),
 filename text not null default '' check(length(filename)<=200),
 attachment bytea,
 check ((attachment is null and filename='') or
        (attachment is not null and filename<>'' and octet_length(attachment) between 1 and 2097152)),
 unique(organization_id,resource_id,version),
 created_at timestamptz not null default now()
);
alter table public.library_revisions enable row level security;
revoke all on public.library_revisions from public,anon,authenticated;
grant select,insert(id,organization_id,resource_id,version,title,tags,notes,url,filename,attachment) on public.library_revisions to authenticated;
create policy library_read on public.library_revisions for select to authenticated using(private.has_role(organization_id,array['owner','admin','collaborator','reader']::public.member_role[]));
create policy library_add on public.library_revisions for insert to authenticated with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create function private.library_revision_order() returns trigger language plpgsql set search_path='' as $$
begin
 if new.version=1 then
  if new.id<>new.resource_id then raise exception 'Identificador inicial inválido'; end if;
 elsif not exists(select 1 from public.library_revisions where organization_id=new.organization_id and resource_id=new.resource_id and version=new.version-1) then
  raise exception 'Falta la revisión anterior';
 end if;
 return new;
end $$;
create trigger library_order before insert on public.library_revisions for each row execute function private.library_revision_order();
create view public.current_library_resources with(security_invoker=true) as
 select distinct on(organization_id,resource_id) id,organization_id,resource_id,version,title,tags,notes,url,filename,created_at,concat_ws(' ',title,tags,notes) as search_text
 from public.library_revisions order by organization_id,resource_id,version desc;
revoke all on public.current_library_resources from public,anon,authenticated;
grant select on public.current_library_resources to authenticated;

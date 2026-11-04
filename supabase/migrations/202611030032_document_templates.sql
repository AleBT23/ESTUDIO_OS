create table public.document_templates(
 id uuid primary key,organization_id uuid not null,source_id uuid not null,source_version int not null check(source_version>0),
 name text not null check(length(trim(name)) between 2 and 160),version int not null check(version>0),
 title text not null,kind text not null,body text not null,margins jsonb not null,
 created_at timestamptz not null default now(),created_by uuid not null default auth.uid() references auth.users(id),
 foreign key(organization_id,source_id) references public.studio_documents(organization_id,id)
);
create unique index template_version on public.document_templates(organization_id,lower(trim(name)),version);
alter table public.document_templates enable row level security;
revoke all on public.document_templates from public,anon,authenticated;
grant select on public.document_templates to authenticated;
grant insert(id,organization_id,source_id,source_version,name,version) on public.document_templates to authenticated;
create policy template_admin on public.document_templates for all to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]))
 with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create function private.snapshot_document_template() returns trigger language plpgsql set search_path='' as $$
declare latest int;
begin
 select coalesce(max(version),0) into latest from public.document_templates where organization_id=new.organization_id and lower(trim(name))=lower(trim(new.name));
 if new.version<>latest+1 then raise exception 'La plantilla cambió o el nombre ya existe';end if;
 select d.title,d.kind,d.body,d.margins into strict new.title,new.kind,new.body,new.margins from public.studio_documents d
 where d.organization_id=new.organization_id and d.id=new.source_id and d.version=new.source_version and d.deleted_at is null;
 return new;
end $$;
revoke all on function private.snapshot_document_template() from public,anon,authenticated;
create trigger template_snapshot before insert on public.document_templates for each row execute function private.snapshot_document_template();
create view public.latest_document_templates with(security_invoker=true) as
 select distinct on(organization_id,lower(trim(name))) id,organization_id,name,version,kind,created_at
 from public.document_templates order by organization_id,lower(trim(name)),version desc;
revoke all on public.latest_document_templates from public,anon,authenticated;
grant select on public.latest_document_templates to authenticated;

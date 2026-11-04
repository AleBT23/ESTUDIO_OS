alter table public.phase_templates add column on_quote_acceptance boolean not null default false,
 add check(not on_quote_acceptance or service_id is null);
create unique index phase_default_per_line on public.phase_templates(organization_id,business_line_id)
 where on_quote_acceptance;
grant update(on_quote_acceptance) on public.phase_templates to authenticated;

create function private.apply_quote_package_phases() returns trigger language plpgsql set search_path='' as $$
begin
 if new.scope_change_id is not null or exists(
   select 1 from public.projects p where p.organization_id=new.organization_id and p.id=new.project_id and p.quote_version_id is not null
 ) then
   insert into public.project_phase_plans(id,organization_id,project_id,template_id,template_version)
   select gen_random_uuid(),new.organization_id,new.project_id,t.id,t.version
   from public.phase_templates t where t.organization_id=new.organization_id and t.business_line_id=new.business_line_id and t.on_quote_acceptance
   on conflict(project_id,template_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.apply_quote_package_phases() from public,anon,authenticated;
create trigger quote_package_phases after insert on public.project_service_packages for each row execute function private.apply_quote_package_phases();

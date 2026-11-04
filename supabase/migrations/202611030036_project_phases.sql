create table public.phase_templates(
 id uuid primary key,organization_id uuid not null,business_line_id uuid not null,service_id uuid,
 name text not null check(length(trim(name)) between 2 and 160),
 phases text[] not null check(private.valid_procedure_steps(phases)),version int not null default 1,
 unique(organization_id,id),
 foreign key(organization_id,business_line_id) references public.business_lines(organization_id,id),
 foreign key(organization_id,service_id) references public.services(organization_id,id)
);
create table public.project_phase_plans(
 id uuid primary key,organization_id uuid not null,project_id uuid not null,template_id uuid not null,
 template_version int not null,name text not null,phases text[] not null,completed int not null default 0,
 check(completed between 0 and cardinality(phases)),unique(project_id,template_id),
 foreign key(organization_id,project_id) references public.projects(organization_id,id),
 foreign key(organization_id,template_id) references public.phase_templates(organization_id,id)
);
alter table public.phase_templates enable row level security;
alter table public.project_phase_plans enable row level security;
revoke all on public.phase_templates,public.project_phase_plans from public,anon,authenticated;
grant select on public.phase_templates,public.project_phase_plans to authenticated;
grant insert(id,organization_id,business_line_id,service_id,name,phases),update(name,phases) on public.phase_templates to authenticated;
grant insert(id,organization_id,project_id,template_id,template_version),update(completed) on public.project_phase_plans to authenticated;
create policy template_read on public.phase_templates for select to authenticated using(private.has_role(organization_id,array['owner','admin','collaborator','reader']::public.member_role[]));
create policy template_manage on public.phase_templates for all to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[])) with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy plan_read on public.project_phase_plans for select to authenticated using(private.has_role(organization_id,array['owner','admin','collaborator','reader']::public.member_role[]));
create policy plan_manage on public.project_phase_plans for all to authenticated using(private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[])) with check(private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[]) and exists(select 1 from public.projects p where p.organization_id=project_phase_plans.organization_id and p.id=project_phase_plans.project_id and p.deleted_at is null));
create function private.check_phase_template() returns trigger language plpgsql set search_path='' as $$
begin
 if new.service_id is not null and not exists(select 1 from public.services where id=new.service_id and organization_id=new.organization_id and business_line_id=new.business_line_id) then raise exception 'El servicio pertenece a otra línea';end if;
 if tg_op='UPDATE' then new.version:=old.version+1;end if;
 return new;
end $$;
create trigger check_phase_template before insert or update on public.phase_templates for each row execute function private.check_phase_template();
create function private.snapshot_project_phases() returns trigger language plpgsql set search_path='' as $$
begin
 select t.name,t.phases into strict new.name,new.phases from public.phase_templates t where t.organization_id=new.organization_id and t.id=new.template_id and t.version=new.template_version;
 return new;
end $$;
create trigger snapshot_project_phases before insert on public.project_phase_plans for each row execute function private.snapshot_project_phases();

-- Las dos líneas iniciales del estudio tienen recorridos distintos.
create function private.default_project_phases(line_name text) returns text[]
language sql immutable set search_path='' as $$
 select case line_name when 'Arquitectura' then array['Programa arquitectónico','Anteproyecto','Proyecto ejecutivo','Entrega']
 when 'Visualización' then array['Brief y referencias','Modelado','Materiales e iluminación','Renders y entrega'] end
$$;
insert into public.phase_templates(id,organization_id,business_line_id,name,phases)
 select gen_random_uuid(),organization_id,id,name,private.default_project_phases(name) from public.business_lines
 where name in ('Arquitectura','Visualización');
create function private.seed_project_phases() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.phase_templates(id,organization_id,business_line_id,name,phases)
 values(gen_random_uuid(),new.organization_id,new.id,new.name,private.default_project_phases(new.name));
 return new;
end $$;
revoke all on function private.seed_project_phases() from public,anon,authenticated;
create trigger seed_project_phases after insert on public.business_lines for each row
 when(new.name in ('Arquitectura','Visualización')) execute function private.seed_project_phases();

alter table public.project_notes add column predecessor_id uuid,
 add foreign key(organization_id,predecessor_id) references public.project_notes(organization_id,id),
 add check(predecessor_id is null or (kind='task' and predecessor_id<>id));
create index notes_by_predecessor on public.project_notes(predecessor_id) where predecessor_id is not null;
grant update(predecessor_id) on public.project_notes to authenticated;
create function private.validate_task_dependency() returns trigger language plpgsql set search_path='' as $$
declare prerequisite public.project_notes;
begin
 if new.predecessor_id is not distinct from old.predecessor_id and new.completed_at is not distinct from old.completed_at then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.project_id::text,42));
 if new.predecessor_id is distinct from old.predecessor_id and old.completed_at is not null then
 raise exception 'Reabre la tarea antes de cambiar la dependencia';end if;
 if new.predecessor_id is not null then
 select * into prerequisite from public.project_notes where id=new.predecessor_id and organization_id=new.organization_id and project_id=new.project_id and kind='task' and deleted_at is null;
 if not found then raise exception 'Selecciona una tarea del mismo proyecto';end if;
 if new.completed_at is not null and prerequisite.completed_at is null then raise exception 'Completa primero la tarea previa';end if;
 if new.predecessor_id is distinct from old.predecessor_id and exists(
 with recursive chain(id,previous) as (select prerequisite.id,prerequisite.predecessor_id union
 select n.id,n.predecessor_id from chain c join public.project_notes n on n.id=c.previous)
 select 1 from chain where id=new.id) then raise exception 'La dependencia produciría un ciclo';end if;
 end if;
 if new.completed_at is null and old.completed_at is not null and exists(select 1 from public.project_notes where predecessor_id=new.id and completed_at is not null and deleted_at is null) then
 raise exception 'Reabre primero las tareas dependientes';end if;
 return new;
end $$;
create trigger validate_task_dependency before update of predecessor_id,completed_at on public.project_notes for each row execute function private.validate_task_dependency();

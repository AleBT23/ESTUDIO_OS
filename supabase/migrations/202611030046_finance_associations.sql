-- NOT VALID preserves pre-existing associations; new writes are checked immediately.
alter table public.works add constraint work_project_client
 foreign key(organization_id,client_id,project_id) references public.projects(organization_id,client_id,id) not valid;
alter table public.finance_cases add constraint agreement_project_client
 foreign key(organization_id,client_id,project_id) references public.projects(organization_id,client_id,id) not valid;

create function private.check_agreement_work() returns trigger language plpgsql set search_path='' as $$
declare work_project uuid; work_client uuid; selected_project_client uuid;
begin
 select w.project_id,coalesce(w.client_id,p.client_id) into work_project,work_client
 from public.works w left join public.projects p on p.organization_id=w.organization_id and p.id=w.project_id
 where w.id=new.work_id and w.organization_id=new.organization_id;
 if new.project_id is not null then
  select client_id into selected_project_client from public.projects where organization_id=new.organization_id and id=new.project_id;
 end if;
 if (new.project_id is not null and work_project is not null and new.project_id<>work_project)
 or (coalesce(new.client_id,selected_project_client) is not null and work_client is not null and coalesce(new.client_id,selected_project_client)<>work_client)
 then raise exception 'La obra no corresponde al proyecto o al cliente seleccionado';end if;
 return new;
end $$;
create trigger agreement_work before insert or update of organization_id,client_id,project_id,work_id on public.finance_cases
 for each row when(new.work_id is not null) execute function private.check_agreement_work();

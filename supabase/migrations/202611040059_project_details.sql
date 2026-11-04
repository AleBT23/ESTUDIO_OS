alter table public.projects add column target_end date,
 add column lead_id uuid,
 add foreign key(organization_id,lead_id) references public.memberships(organization_id,user_id),
 add check(target_end is null or target_end>=start_date);

create function public.edit_project_details(org uuid,project uuid,expected_version integer,
 title text,site text,start_on date,end_on date,lead uuid,project_state text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes'; end if;
 if title is null or length(trim(title)) not between 2 and 200 or site is null or length(site)>500
  or start_on is null or project_state is null or project_state not in ('active','paused','closed','archived')
 then raise exception 'Datos de proyecto inválidos'; end if;
 update public.projects set name=trim(title),location=trim(site),start_date=start_on,target_end=end_on,
 lead_id=lead,state=project_state
 where organization_id=org and id=project and version=expected_version and deleted_at is null;
 if not found then raise exception 'Actualiza el expediente antes de guardar'; end if;
end $$;
revoke all on function public.edit_project_details(uuid,uuid,integer,text,text,date,date,uuid,text) from public,anon;
grant execute on function public.edit_project_details(uuid,uuid,integer,text,text,date,date,uuid,text) to authenticated;
create or replace view public.agenda_events with(security_invoker=true) as
select organization_id,id,project_id,'task'::text kind,body label,due_on
from public.project_notes_context where kind='task' and deleted_at is null and completed_at is null and due_on is not null
union all
select organization_id,id,project_id,'collection',label,due_date from public.payment_schedule_balances where balance_cents>0
union all
select d.organization_id,d.id,d.project_id,'delivery',d.name,d.due_on
from public.deliverable_status d join public.projects p on p.organization_id=d.organization_id and p.id=d.project_id
where d.state<>'approved' and p.deleted_at is null

union all
select organization_id,id,null::uuid,'follow_up',name,next_follow_up
from public.opportunities where deleted_at is null and stage not in ('won','lost') and next_follow_up is not null
union all
select organization_id,id,project_id,'publication',title,publication_on
from public.editorial_items where status='scheduled'
union all
select b.organization_id,b.id,b.project_id,d.kind,b.name,d.due_on
from public.finance_case_balances b
join public.finance_cases c on c.organization_id=b.organization_id and c.id=b.id
cross join lateral (values
 ('agreement_collection',c.collect_on,b.receivable_cents),
 ('agreement_payment',c.pay_on,b.payable_cents)
) as d(kind,due_on,balance)
where d.due_on is not null and d.balance>0
union all
select organization_id,id,null::uuid,'personal',label,due_on from public.personal_reminders where not completed
union all select organization_id,id,id,'project_end',name,target_end from public.projects where target_end is not null and deleted_at is null and state in ('active','paused');

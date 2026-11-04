create table public.personal_reminders (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 user_id uuid not null default auth.uid(),
 label text not null check(length(trim(label)) between 2 and 240),
 due_on date not null,
 repeat_days integer not null default 0 check(repeat_days between 0 and 365),
 completed boolean not null default false,
 version integer not null default 1,
 foreign key(organization_id,user_id) references public.memberships(organization_id,user_id)
);
create index personal_reminders_inbox on public.personal_reminders(organization_id,user_id,completed,due_on,id);
alter table public.personal_reminders enable row level security;
revoke all on public.personal_reminders from public,anon,authenticated;
grant select,insert(id,organization_id,label,due_on,repeat_days),update(label,due_on,repeat_days,completed)
on public.personal_reminders to authenticated;
create policy own_reminders on public.personal_reminders for all to authenticated
using(user_id=auth.uid() and private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[]))
with check(user_id=auth.uid() and private.has_role(organization_id,array['owner','admin','collaborator']::public.member_role[]));

create function private.advance_personal_reminder() returns trigger language plpgsql
set search_path='' as $$
begin
 if old.completed then raise exception 'El recordatorio ya se completó'; end if;
 new.version := old.version+1;
 if new.completed and new.repeat_days>0 then
   insert into public.personal_reminders(organization_id,label,due_on,repeat_days)
   values(new.organization_id,new.label,new.due_on+new.repeat_days,new.repeat_days);
 end if;
 return new;
end $$;
create trigger advance_reminder before update on public.personal_reminders
for each row execute function private.advance_personal_reminder();
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
select organization_id,id,null::uuid,'personal',label,due_on from public.personal_reminders where not completed;

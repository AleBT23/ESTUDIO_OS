create table public.schedule_changes(
 id uuid primary key,
 organization_id uuid not null,
 schedule_id uuid not null,
 result_id uuid not null,
 previous_due date not null,
 previous_amount bigint not null,
 previous_balance bigint not null,
 amount bigint not null,
 due_on date not null,
 actor_id uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,schedule_id) references public.payment_schedules(organization_id,id),
 foreign key(organization_id,result_id) references public.payment_schedules(organization_id,id)
);
alter table public.schedule_changes enable row level security;
revoke all on public.schedule_changes from public,anon,authenticated;
grant select on public.schedule_changes to authenticated;
create policy schedule_change_read on public.schedule_changes for select to authenticated
using(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create function public.replan_schedule(org uuid, schedule uuid, request_id uuid, expected_due date,
 expected_amount bigint, expected_balance bigint, portion bigint, new_due date)
returns uuid language plpgsql security definer set search_path='' as $$
declare original public.payment_schedules; prior public.schedule_changes; remainder bigint; target uuid;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes'; end if;
 select * into strict original from public.payment_schedules where organization_id=org and id=schedule for update;
 select * into prior from public.schedule_changes where id=request_id and organization_id=org;
 if found then
   if (prior.schedule_id,prior.previous_due,prior.previous_amount,prior.previous_balance,prior.amount,prior.due_on)
     is distinct from (schedule,expected_due,expected_amount,expected_balance,portion,new_due)
   then raise exception 'La solicitud ya corresponde a otro cambio'; end if;
   return prior.result_id;
 end if;
 select original.amount_cents-coalesce(sum(amount_cents),0) into remainder from public.payments
 where organization_id=org and schedule_id=schedule and state='posted';
 if (original.due_date,original.amount_cents,remainder) is distinct from (expected_due,expected_amount,expected_balance)
 then raise exception 'El plan o su saldo cambiaron'; end if;
 if portion is null or portion<=0 or portion>remainder or new_due is null or new_due=original.due_date
 then raise exception 'Importe o nueva fecha inválidos'; end if;
 if portion=original.amount_cents then
   update public.payment_schedules set due_date=new_due where id=schedule;
   target:=schedule;
 else
   update public.payment_schedules set amount_cents=amount_cents-portion where id=schedule;
   insert into public.payment_schedules(organization_id,project_id,label,amount_cents,due_date,scope_change_id)
   values(org,original.project_id,original.label,portion,new_due,original.scope_change_id) returning id into target;
 end if;
 insert into public.schedule_changes(id,organization_id,schedule_id,result_id,previous_due,previous_amount,previous_balance,amount,due_on)
 values(request_id,org,schedule,target,expected_due,expected_amount,expected_balance,portion,new_due);
 return target;
end $$;
revoke all on function public.replan_schedule(uuid,uuid,uuid,date,bigint,bigint,bigint,date) from public,anon;
grant execute on function public.replan_schedule(uuid,uuid,uuid,date,bigint,bigint,bigint,date) to authenticated;

create view public.schedule_change_history with(security_invoker=true) as
select c.id,c.organization_id,c.schedule_id,c.result_id,s.project_id,p.name project_name,
 s.label,c.previous_due,c.due_on,c.amount::text amount_cents,c.created_at,c.actor_id
from public.schedule_changes c
join public.payment_schedules s on s.organization_id=c.organization_id and s.id=c.schedule_id
join public.projects p on p.organization_id=s.organization_id and p.id=s.project_id;
revoke all on public.schedule_change_history from public,anon,authenticated;
grant select on public.schedule_change_history to authenticated;
create index schedule_change_order on public.schedule_changes(organization_id,created_at desc,id);

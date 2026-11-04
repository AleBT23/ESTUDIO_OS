-- El importe vigente se reduce solo por el saldo cancelado. El historial conserva los valores originales.
create table public.schedule_cancellations (
 id uuid primary key, organization_id uuid not null, schedule_id uuid not null,
 previous_due date not null, previous_amount bigint not null,
 amount_cents bigint not null check(amount_cents > 0 and amount_cents <= previous_amount),
 reason text not null check(length(trim(reason)) between 3 and 1000),
 actor_id uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,schedule_id) references public.payment_schedules(organization_id,id)
);
create index schedule_cancellation_history_order on public.schedule_cancellations(organization_id,created_at desc,id);
alter table public.schedule_cancellations enable row level security;
revoke all on public.schedule_cancellations from public,anon,authenticated;
grant select on public.schedule_cancellations to authenticated;
create policy cancellation_read on public.schedule_cancellations for select to authenticated
using(private.has_role(organization_id,array['owner','admin']::public.member_role[]));

alter table public.payment_schedules add column cancelled_cents bigint not null default 0 check(cancelled_cents>=0);
alter table public.payment_schedules drop constraint payment_schedules_amount_cents_check,
 add check(amount_cents>=0 and (amount_cents>0 or cancelled_cents>0));

create function public.cancel_schedule_balance(org uuid,schedule uuid,request_id uuid,expected_due date,
 expected_amount bigint, expected_balance bigint, reason text)
returns void language plpgsql security definer set search_path='' as $$
declare original public.payment_schedules; prior public.schedule_cancellations; remainder bigint;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes'; end if;
 select * into strict original from public.payment_schedules where organization_id=org and id=schedule for update;
 select * into prior from public.schedule_cancellations where organization_id=org and id=request_id;
 if found then
   if (prior.schedule_id,prior.previous_due,prior.previous_amount,prior.amount_cents,prior.reason)
     is distinct from (schedule,expected_due,expected_amount,expected_balance,trim(reason))
   then raise exception 'La solicitud corresponde a otro cambio'; end if;
   return;
 end if;
 select original.amount_cents-coalesce(sum(amount_cents),0) into remainder from public.payments
 where organization_id=org and schedule_id=schedule and state='posted';
 if remainder<=0 or (original.due_date,original.amount_cents,remainder) is distinct from (expected_due,expected_amount,expected_balance)
 then raise exception 'El plan o su saldo cambiaron'; end if;
 insert into public.schedule_cancellations(id,organization_id,schedule_id,previous_due,previous_amount,amount_cents,reason)
 values(request_id,org,schedule,original.due_date,original.amount_cents,remainder,trim(reason));
 update public.payment_schedules set amount_cents=amount_cents-remainder,cancelled_cents=cancelled_cents+remainder where id=schedule;
end $$;
revoke all on function public.cancel_schedule_balance(uuid,uuid,uuid,date,bigint,bigint,text) from public,anon;
grant execute on function public.cancel_schedule_balance(uuid,uuid,uuid,date,bigint,bigint,text) to authenticated;
create view public.schedule_cancellation_history with(security_invoker=true) as
select c.id,c.organization_id,s.project_id,p.name project_name,s.label,c.previous_amount::text previous_amount,
 c.amount_cents::text amount_cents,c.reason,c.created_at,c.actor_id
from public.schedule_cancellations c
join public.payment_schedules s on s.organization_id=c.organization_id and s.id=c.schedule_id
join public.projects p on p.organization_id=s.organization_id and p.id=s.project_id;
revoke all on public.schedule_cancellation_history from public,anon,authenticated;
grant select on public.schedule_cancellation_history to authenticated;

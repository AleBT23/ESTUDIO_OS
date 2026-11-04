alter table public.finance_entries
 add column reversal_reason text check(length(trim(reversal_reason)) between 3 and 500),
 add column reversed_by uuid references auth.users(id),
 add column reversed_at timestamptz;
create function private.reverse_finance_entry() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.reversed_at is not null or new.reversal_reason is null then
   raise exception 'Movimiento revertido o motivo vacío';
 end if;
 new.reversed_at:=clock_timestamp();
 new.reversed_by:=auth.uid();
 return new;
end $$;
revoke all on function private.reverse_finance_entry() from public,anon,authenticated;
create trigger finance_reversal before update on public.finance_entries
for each row execute function private.reverse_finance_entry();
grant update(reversal_reason) on public.finance_entries to authenticated;
create or replace function private.check_finance_entry() returns trigger
language plpgsql security definer set search_path='' as $$
declare ceiling bigint; settled numeric; zone text;
begin
 if not private.has_role(new.organization_id,array['owner','admin']::public.member_role[]) then
   raise exception 'Permisos insuficientes';
 end if;
 select case when new.direction='in' then c.revenue_cents else c.cost_cents end,o.timezone
 into strict ceiling,zone from public.finance_cases c join public.organizations o on c.organization_id=o.id
 where c.organization_id=new.organization_id and c.id=new.case_id for update of c;
 if new.paid_on>(now() at time zone zone)::date then raise exception 'Fecha futura'; end if;
 select coalesce(sum(amount_cents),0) into settled from public.finance_entries
 where organization_id=new.organization_id and case_id=new.case_id and direction=new.direction and reversed_at is null;
 if settled+new.amount_cents>ceiling then raise exception 'El importe supera el saldo'; end if;
 return new;
end $$;

create or replace view public.finance_case_balances with(security_invoker=true) as
with totals as (
 select organization_id,case_id,
 coalesce(sum(amount_cents) filter(where direction='in'),0)::bigint received,
 coalesce(sum(amount_cents) filter(where direction='out'),0)::bigint paid
 from public.finance_entries where reversed_at is null group by organization_id,case_id
)
select c.*, coalesce(t.received,0) received_cents,coalesce(t.paid,0) paid_cents,
 c.revenue_cents-coalesce(t.received,0) receivable_cents,
 c.cost_cents-coalesce(t.paid,0) payable_cents,
 case when not c.managed then c.revenue_cents-c.cost_cents end expected_margin_cents,
 coalesce(t.received,0)-coalesce(t.paid,0) cash_cents
from public.finance_cases c left join totals t on c.organization_id=t.organization_id and c.id=t.case_id;

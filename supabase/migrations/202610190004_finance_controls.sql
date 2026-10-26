alter table public.payments add column reversal_reason text check(char_length(reversal_reason)<=1000);
alter table public.payments add column reversed_at timestamptz;
create view public.payment_schedule_balances with(security_invoker=true) as
 select s.*,coalesce(p.collected_cents,0)::bigint as collected_cents,(s.amount_cents-coalesce(p.collected_cents,0))::bigint as balance_cents
 from public.payment_schedules s left join(select organization_id,schedule_id,sum(amount_cents) collected_cents from public.payments where state='posted' group by organization_id,schedule_id) p on p.organization_id=s.organization_id and p.schedule_id=s.id;
revoke all on public.payment_schedule_balances from public,anon,authenticated;
grant select on public.payment_schedule_balances to authenticated;
create function public.reverse_payment(org uuid,payment uuid,expected_version integer,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 if reason is null or char_length(trim(reason)) not between 3 and 1000 then raise exception 'Explica el motivo del reverso';end if;
 update public.payments set state='reversed',reversal_reason=trim(reason),reversed_at=clock_timestamp() where organization_id=org and id=payment and version=expected_version and state='posted' returning id into target;
 if target is null then raise exception 'El movimiento cambió o ya fue revertido';end if;
end $$;
revoke all on function public.reverse_payment(uuid,uuid,integer,text) from public;
grant execute on function public.reverse_payment(uuid,uuid,integer,text) to authenticated;

-- Transiciones comerciales explícitas. Los PDFs y snapshots previos no se editan.
alter table public.quote_status_events add column reason text not null default '' check(char_length(reason)<=1000);

create function public.change_quote_lifecycle(org uuid,quote uuid,expected_version integer,intent text,reason text,new_valid_until date default null) returns void
language plpgsql security definer set search_path='' as $$
declare q public.quotes;next_status text;today date;
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 if reason is null or char_length(trim(reason)) not between 3 and 1000 then raise exception 'Registra el motivo del cambio';end if;
 select * into q from public.quotes where organization_id=org and id=quote and version=expected_version and deleted_at is null for update;
 if q.id is null then raise exception 'Conflicto de edición';end if;
 if q.status='accepted' then raise exception 'Una cotización aceptada conserva su alcance; registra los cambios por separado';end if;
 select (now() at time zone timezone)::date into today from public.organizations where id=org;
 if intent='reject' and q.status in ('draft','sent') then
  next_status:='rejected';
 elsif intent='expire' and q.status in ('draft','sent') then
  if q.valid_until>=today then raise exception 'La vigencia todavía no ha concluido';end if;
  next_status:='expired';
 elsif intent='revise' and q.status in ('sent','rejected','expired') then
  if new_valid_until is null or new_valid_until<today then raise exception 'Define una nueva vigencia válida';end if;
  next_status:='draft';
 else
  raise exception 'Transición no permitida';
 end if;
 update public.quotes set status=next_status,
  valid_until=case when intent='revise' then new_valid_until else valid_until end,
  issued_version_id=case when intent='revise' then null else issued_version_id end
 where organization_id=org and id=quote;
 insert into public.quote_status_events(organization_id,quote_id,actor_id,status,reason) values(org,quote,auth.uid(),next_status,trim(reason));
end $$;
revoke all on function public.change_quote_lifecycle(uuid,uuid,integer,text,text,date) from public;
grant execute on function public.change_quote_lifecycle(uuid,uuid,integer,text,text,date) to authenticated;

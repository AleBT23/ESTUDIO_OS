-- Subledger for new agreements. Historical project schedules remain authoritative.
create table public.works (
  id uuid primary key, organization_id uuid not null references public.organizations(id),
  name text not null check(length(trim(name)) between 2 and 160),
  client_id uuid, project_id uuid,
  unique(organization_id,id),
  foreign key(organization_id,client_id) references public.clients(organization_id,id),
  foreign key(organization_id,project_id) references public.projects(organization_id,id)
);
create table public.finance_cases (
  id uuid primary key, organization_id uuid not null references public.organizations(id),
  name text not null check(length(trim(name)) between 2 and 160),
  area text not null check(area in ('architecture','construction','service')),
  managed boolean not null default false check(not managed or area='construction'),
  client_id uuid, project_id uuid, work_id uuid,
  provider text check(length(provider) between 1 and 160),
  revenue_cents bigint not null check(revenue_cents between 0 and 99999999999999),
  cost_cents bigint not null check(cost_cents between 0 and 99999999999999),
  check(revenue_cents>0 or cost_cents>0),
  created_at timestamptz not null default now(),
  unique(organization_id,id),
  foreign key(organization_id,client_id) references public.clients(organization_id,id),
  foreign key(organization_id,project_id) references public.projects(organization_id,id),
  foreign key(organization_id,work_id) references public.works(organization_id,id)
);
create table public.finance_entries (
  id uuid primary key, organization_id uuid not null, case_id uuid not null,
  direction text not null check(direction in ('in','out')),
  advance boolean not null default false, paid_on date not null,
  amount_cents bigint not null check(amount_cents>0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(organization_id,case_id) references public.finance_cases(organization_id,id)
);
create index finance_case_area on public.finance_cases(organization_id,area,created_at desc);
create index finance_entry_case on public.finance_entries(organization_id,case_id,direction);

do $$ declare tbl text; begin
 foreach tbl in array array['works','finance_cases','finance_entries'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from public, anon, authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('create policy finance_access on public.%I for all to authenticated using(private.has_role(organization_id,array[''owner'',''admin'']::public.member_role[])) with check(private.has_role(organization_id,array[''owner'',''admin'']::public.member_role[]))',tbl);
 end loop;
end $$;
grant insert(id,organization_id,name,client_id,project_id) on public.works to authenticated;
grant insert(id,organization_id,name,area,managed,client_id,project_id,work_id,provider,revenue_cents,cost_cents) on public.finance_cases to authenticated;
grant insert(id,organization_id,case_id,direction,advance,paid_on,amount_cents) on public.finance_entries to authenticated;

create function private.check_finance_entry() returns trigger
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
 where organization_id=new.organization_id and case_id=new.case_id and direction=new.direction;
 if settled+new.amount_cents>ceiling then raise exception 'El importe supera el saldo'; end if;
 return new;
end $$;
revoke all on function private.check_finance_entry() from public,anon,authenticated;
create trigger finance_entry_guard before insert on public.finance_entries for each row execute function private.check_finance_entry();

create view public.finance_case_balances with(security_invoker=true) as
with totals as (
 select organization_id,case_id,
 coalesce(sum(amount_cents) filter(where direction='in'),0)::bigint received,
 coalesce(sum(amount_cents) filter(where direction='out'),0)::bigint paid
 from public.finance_entries group by organization_id,case_id
)
select c.*, coalesce(t.received,0) received_cents,coalesce(t.paid,0) paid_cents,
 c.revenue_cents-coalesce(t.received,0) receivable_cents,
 c.cost_cents-coalesce(t.paid,0) payable_cents,
 case when not c.managed then c.revenue_cents-c.cost_cents end expected_margin_cents,
 coalesce(t.received,0)-coalesce(t.paid,0) cash_cents
from public.finance_cases c left join totals t on c.organization_id=t.organization_id and c.id=t.case_id;
revoke all on public.finance_case_balances from public,anon,authenticated;
grant select on public.finance_case_balances to authenticated;

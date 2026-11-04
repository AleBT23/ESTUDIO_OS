create table public.case_invoices (
 id uuid primary key, organization_id uuid not null, case_id uuid not null,
 reference text not null check (length(trim(reference)) between 1 and 120),
 issued_on date not null, amount_cents bigint not null check(amount_cents between 1 and 99999999999999),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(organization_id,case_id) references public.finance_cases(organization_id,id)
);
create unique index case_invoice_reference on public.case_invoices(organization_id,lower(trim(reference)));
create index case_invoice_history on public.case_invoices(organization_id,case_id,issued_on desc,id);
alter table public.case_invoices enable row level security;
revoke all on public.case_invoices from public,anon,authenticated;
grant select on public.case_invoices to authenticated;
grant insert(id,organization_id,case_id,reference,issued_on,amount_cents) on public.case_invoices to authenticated;
create policy invoice_access on public.case_invoices for all to authenticated
using(private.has_role(organization_id,array['owner','admin']::public.member_role[]))
with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create view public.case_invoice_totals with(security_invoker=true) as
select organization_id,case_id,sum(amount_cents)::text invoiced_cents from public.case_invoices group by organization_id,case_id;
revoke all on public.case_invoice_totals from public,anon,authenticated;
grant select on public.case_invoice_totals to authenticated;

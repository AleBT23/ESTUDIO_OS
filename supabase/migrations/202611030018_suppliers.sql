create table public.suppliers(
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 name text not null check(length(trim(name)) between 2 and 160),
 kind text not null check(kind in ('supplier','subcontractor')),
 contact text not null default '' check(length(contact)<=300),
 unique(organization_id,id)
);
create unique index supplier_name on public.suppliers(organization_id,lower(trim(name)));
alter table public.suppliers enable row level security;
revoke all on public.suppliers from public,anon,authenticated;
grant select on public.suppliers to authenticated;
grant insert(id,organization_id,name,kind,contact) on public.suppliers to authenticated;
create policy supplier_access on public.suppliers for all to authenticated
using(private.has_role(organization_id,array['owner','admin']::public.member_role[]))
with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
alter table public.finance_cases add column supplier_id uuid,
 add foreign key(organization_id,supplier_id) references public.suppliers(organization_id,id);
create index case_supplier on public.finance_cases(organization_id,supplier_id) where supplier_id is not null;
grant insert(supplier_id) on public.finance_cases to authenticated;
create function private.case_supplier_name() returns trigger language plpgsql set search_path='' as $$
begin
 select name into strict new.provider from public.suppliers where organization_id=new.organization_id and id=new.supplier_id;
 return new;
end $$;
create trigger case_supplier_name before insert on public.finance_cases for each row when(new.supplier_id is not null) execute function private.case_supplier_name();
revoke all on function private.case_supplier_name() from public,anon,authenticated;

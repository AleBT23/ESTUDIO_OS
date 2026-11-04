alter table public.collaborator_fees
  add column area text not null default 'architecture' check(area in ('architecture','construction','service')),
  add column managed boolean not null default false check(not managed or area='construction');
grant insert(area,managed) on public.collaborator_fees to authenticated;

create or replace function private.fee_commitment() returns trigger language plpgsql security definer set search_path='' as $$
declare customer uuid;amount bigint;
begin
 if not private.has_role(new.organization_id,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes';end if;
 select client_id into strict customer from public.projects where organization_id=new.organization_id and id=new.project_id and deleted_at is null;
 if new.rate_bps is not null then
 update public.package_financials set allocated_bps=allocated_bps+new.rate_bps where organization_id=new.organization_id and package_id=new.package_id and allocated_bps+new.rate_bps<=10000
 returning round(new.base_cents::numeric*allocated_bps/10000)-round(new.base_cents::numeric*(allocated_bps-new.rate_bps)/10000) into amount;
 if not found then raise exception 'La distribución supera el 100 por ciento';end if;
 else amount:=new.fixed_cents;
 end if;
 insert into public.finance_cases(id,organization_id,client_id,project_id,package_id,name,area,managed,revenue_cents,cost_cents)
 values(new.id,new.organization_id,customer,new.project_id,new.package_id,new.label,new.area,new.managed,0,amount);
 return new;
end $$;

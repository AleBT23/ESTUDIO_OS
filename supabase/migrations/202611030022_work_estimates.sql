alter table public.work_budget_items
 add column estimated_quantity numeric(12,4) not null default 0 check(estimated_quantity between 0 and quantity),
 add unique(organization_id,work_id,id);
create table public.work_estimates(
 id uuid primary key, organization_id uuid not null, work_id uuid not null, item_id uuid not null,
 measured_on date not null, quantity numeric(12,4) not null check(quantity>0),
 amount_cents numeric not null default 0 check(amount_cents>=0),
 notes text not null default '' check(length(notes)<=2000),
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id),
 foreign key(organization_id,work_id,item_id) references public.work_budget_items(organization_id,work_id,id)
);
create index work_estimates_history on public.work_estimates(organization_id,item_id,measured_on desc,id);
alter table public.work_estimates enable row level security;
revoke all on public.work_estimates from public,anon,authenticated;
grant select on public.work_estimates to authenticated;
grant insert(id,organization_id,work_id,item_id,measured_on,quantity,notes) on public.work_estimates to authenticated;
create policy estimate_access on public.work_estimates for all to authenticated
 using(private.has_role(organization_id,array['owner','admin']::public.member_role[]))
 with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create function private.accumulate_work_estimate() returns trigger language plpgsql security definer set search_path='' as $$
declare earned numeric; measured numeric := new.quantity;
begin
 if not private.has_role(new.organization_id,array['owner','admin']::public.member_role[]) or measured<=0 then raise exception 'Estimación inválida';end if;
 update public.work_budget_items set estimated_quantity=estimated_quantity+measured
 where organization_id=new.organization_id and work_id=new.work_id and id=new.item_id and estimated_quantity+measured<=quantity
 returning round(estimated_quantity*unit_price_cents)-round((estimated_quantity-measured)*unit_price_cents) into earned;
 if not found then raise exception 'La cantidad excede el pendiente de esta partida';end if;
 update public.work_estimates set amount_cents=earned where id=new.id;
 return new;
end $$;
revoke all on function private.accumulate_work_estimate() from public,anon,authenticated;
create trigger measure_budget_item after insert on public.work_estimates for each row execute function private.accumulate_work_estimate();

create table public.member_cost_rates(
 id uuid primary key,organization_id uuid not null,member_id uuid not null,
 effective_on date not null,hourly_cents bigint not null check(hourly_cents between 0 and 99999999999999),
 created_at timestamptz not null default clock_timestamp(),actor_id uuid not null default auth.uid() references auth.users(id),
 unique(organization_id,member_id,effective_on),
 foreign key(organization_id,member_id) references public.memberships(organization_id,user_id)
);
alter table public.member_cost_rates enable row level security;
revoke all on public.member_cost_rates from public,anon,authenticated;
grant select,insert(id,organization_id,member_id,effective_on,hourly_cents) on public.member_cost_rates to authenticated;
create policy manage_cost_rates on public.member_cost_rates for all to authenticated
using(private.has_role(organization_id,array['owner','admin']::public.member_role[]))
with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));

create function public.time_cost_report(org uuid,from_date date default null,to_date date default null,
 customer uuid default null,project uuid default null,work uuid default null,package uuid default null,line uuid default null)
returns table(rated_minutes text,unrated_minutes text,estimated_cost text)
language sql stable security invoker set search_path='' as $$
 select coalesce(sum(t.minutes) filter(where r.hourly_cents is not null),0)::text,
 coalesce(sum(t.minutes) filter(where r.hourly_cents is null),0)::text,
 round(coalesce(sum(t.minutes::numeric*r.hourly_cents),0)/60)::text
 from public.project_time t join public.projects p on p.id=t.project_id and p.organization_id=t.organization_id
 left join public.project_service_packages k on k.id=t.package_id and k.organization_id=t.organization_id
 left join lateral(select rate.hourly_cents from public.member_cost_rates rate
 where rate.organization_id=t.organization_id and rate.member_id=t.user_id and rate.effective_on<=t.worked_on
 order by rate.effective_on desc limit 1) r on true
 where t.organization_id=org and work is null and (project is null or t.project_id=project)
 and (customer is null or p.client_id=customer) and (package is null or t.package_id=package)
 and (line is null or k.business_line_id=line) and (from_date is null or t.worked_on>=from_date)
 and (to_date is null or t.worked_on<=to_date)
 having private.has_role(org,array['owner','admin']::public.member_role[]);
$$;
revoke all on function public.time_cost_report(uuid,date,date,uuid,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.time_cost_report(uuid,date,date,uuid,uuid,uuid,uuid,uuid) to authenticated;

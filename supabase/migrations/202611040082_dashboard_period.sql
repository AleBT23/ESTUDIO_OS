create function public.dashboard_period_items(org uuid,from_date date default null,to_date date default null,line uuid default null)
returns table(kind text,id uuid,project_id uuid,label text,event_on date)
language sql stable security invoker set search_path='' as $$
with studio as (
  select timezone,(statement_timestamp() at time zone timezone)::date today
  from public.organizations where id=org
), matching_projects as (
  select p.id,p.name,p.start_date,p.state from public.projects p where p.organization_id=org and p.deleted_at is null
    and (line is null or exists(select 1 from public.project_service_packages k where k.organization_id=org
      and k.project_id=p.id and k.business_line_id=line and k.deleted_at is null))
), events as (
  select 'project'::text kind,p.id,p.id project_id,p.name label,p.start_date event_on from matching_projects p where p.state='active'
  union all
  select 'quote',q.id,null,q.name,coalesce((select max(e.created_at) from public.quote_status_events e
    where e.organization_id=org and e.quote_id=q.id and e.status='sent'),q.updated_at) at time zone s.timezone
  from public.quotes q cross join studio s where q.organization_id=org and q.status='sent' and q.deleted_at is null
    and (line is null or exists(select 1 from public.quote_items i where i.organization_id=org and i.quote_id=q.id and i.business_line_id=line))
  union all
  select a.kind,a.id,a.project_id,a.label,a.due_on from public.agenda_events a join matching_projects p on p.id=a.project_id cross join studio s
  where a.organization_id=org and ((a.kind='task' and a.due_on<s.today) or (a.kind='delivery' and a.due_on between s.today and s.today+6))
)
select e.kind,e.id,e.project_id,e.label,e.event_on::date from events e
where (from_date is null or e.event_on::date>=from_date) and (to_date is null or e.event_on::date<=to_date);
$$;
create function public.dashboard_period_counts(org uuid,from_date date default null,to_date date default null,line uuid default null)
returns table(kind text,total bigint) language sql stable security invoker set search_path='' as $$
select x.kind,count(*) from public.dashboard_period_items(org,from_date,to_date,line) x group by x.kind;
$$;
revoke all on function public.dashboard_period_items(uuid,date,date,uuid),public.dashboard_period_counts(uuid,date,date,uuid) from public,anon;
grant execute on function public.dashboard_period_items(uuid,date,date,uuid),public.dashboard_period_counts(uuid,date,date,uuid) to authenticated;

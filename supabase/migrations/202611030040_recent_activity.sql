create view public.studio_activity with(security_invoker=true) as
select e.organization_id,e.id,'quote'::text source,e.status action,e.created_at occurred_at,q.id target_id,q.name label
 from public.quote_status_events e join public.quotes q on q.organization_id=e.organization_id and q.id=e.quote_id where q.deleted_at is null
union all
select r.organization_id,r.id,'delivery',r.state,r.created_at,r.project_id,d.name
 from public.deliverable_revisions r join public.project_deliverables d on d.organization_id=r.organization_id and d.project_id=r.project_id and d.id=r.deliverable_id
 join public.projects p on p.id=r.project_id and p.organization_id=r.organization_id where p.deleted_at is null
union all
select e.organization_id,e.id,'operation',a.action,a.occurred_at,e.case_id,c.name
 from public.finance_entries e join public.finance_cases c on c.id=e.case_id and c.organization_id=e.organization_id
 cross join lateral (values(case when e.direction='in' then 'received' else 'paid' end,e.created_at),('reversed',e.reversed_at)) a(action,occurred_at)
 where a.occurred_at is not null
union all
select p.organization_id,p.id,'payment',a.action,a.occurred_at,s.project_id,s.label
 from public.payments p join public.payment_schedules s on s.id=p.schedule_id and s.organization_id=p.organization_id
 cross join lateral (values('received',p.created_at),('reversed',p.reversed_at)) a(action,occurred_at)
 where a.occurred_at is not null and p.deleted_at is null
union all
select organization_id,id,'library','revision',created_at,resource_id,title from public.library_revisions;
revoke all on public.studio_activity from public,anon,authenticated;
grant select on public.studio_activity to authenticated;

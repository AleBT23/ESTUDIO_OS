create view public.movement_receipts with(security_invoker=true) as
select p.organization_id,'proyecto'::text source,p.id,p.paid_on,p.amount_cents::text amount,
 'in'::text direction,false managed,p.state='reversed' reversed,p.reversal_reason,
 s.label concept,pr.name project_name,c.name client_name,null::text work_name,
 null::text provider,p.reference
from public.payments p
join public.payment_schedules s on s.organization_id=p.organization_id and s.id=p.schedule_id
join public.projects pr on pr.organization_id=s.organization_id and pr.id=s.project_id
join public.clients c on c.organization_id=pr.organization_id and c.id=pr.client_id
union all
select e.organization_id,'acuerdo',e.id,e.paid_on,e.amount_cents::text,e.direction,a.managed,
 e.reversed_at is not null,e.reversal_reason,a.name,coalesce(pr.name,wp.name),c.name,w.name,
 case when e.direction='out' then a.provider end,case when e.advance then 'Anticipo' end
from public.finance_entries e
join public.finance_cases a on a.organization_id=e.organization_id and a.id=e.case_id
left join public.projects pr on pr.organization_id=a.organization_id and pr.id=a.project_id
left join public.works w on w.organization_id=a.organization_id and w.id=a.work_id
left join public.projects wp on wp.organization_id=w.organization_id and wp.id=w.project_id
left join public.clients c on c.organization_id=a.organization_id and c.id=coalesce(a.client_id,pr.client_id,w.client_id,wp.client_id);
revoke all on public.movement_receipts from public,anon,authenticated;
grant select on public.movement_receipts to authenticated;

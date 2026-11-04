create view public.client_related_records with(security_invoker=true) as
select organization_id,client_id,'project'::text kind,id,name,state::text status from public.projects where deleted_at is null
union all
select organization_id,client_id,'quote',id,name,status::text from public.quotes where deleted_at is null
and private.has_role(organization_id,array['owner','admin']::public.member_role[])
union all
select w.organization_id,coalesce(w.client_id,p.client_id),'work',w.id,w.name,null
from public.works w left join public.projects p on p.organization_id=w.organization_id and p.id=w.project_id
where coalesce(w.client_id,p.client_id) is not null
and private.has_role(w.organization_id,array['owner','admin']::public.member_role[]);
revoke all on public.client_related_records from public,anon,authenticated;
grant select on public.client_related_records to authenticated;

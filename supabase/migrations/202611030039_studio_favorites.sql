create view public.searchable_records with(security_invoker=true) as
select organization_id,'projects'::text source,id,name label from public.projects where deleted_at is null
union all select organization_id,'clients',id,name from public.clients where deleted_at is null
union all select organization_id,'quotes',id,name from public.quotes where deleted_at is null
union all select organization_id,'studio_documents',id,title from public.studio_documents where deleted_at is null
union all select organization_id,'works',id,name from public.works where private.has_role(organization_id,array['owner','admin']::public.member_role[])
union all select organization_id,'finance_cases',id,name from public.finance_cases
union all select organization_id,'opportunities',id,name from public.opportunities where deleted_at is null
union all select organization_id,'editorial_items',id,title from public.editorial_items
union all select organization_id,'library',resource_id,title from public.current_library_resources;
create table public.studio_favorites (
 organization_id uuid not null,user_id uuid not null default auth.uid(),source text not null,record_id uuid not null,
 primary key(organization_id,user_id,source,record_id),
 foreign key(organization_id,user_id) references public.memberships(organization_id,user_id) on delete cascade
);
alter table public.studio_favorites enable row level security;
revoke all on public.studio_favorites from public,anon,authenticated;
grant select,delete,insert(organization_id,source,record_id) on public.studio_favorites to authenticated;
create policy own_read on public.studio_favorites for select to authenticated using(user_id=auth.uid());
create policy own_remove on public.studio_favorites for delete to authenticated using(user_id=auth.uid());
create policy visible_add on public.studio_favorites for insert to authenticated with check(user_id=auth.uid() and exists(
 select 1 from public.searchable_records r where r.organization_id=studio_favorites.organization_id and r.source=studio_favorites.source and r.id=studio_favorites.record_id));
create view public.personal_search_results with(security_invoker=true) as
select r.*,f.record_id is not null favorite from public.searchable_records r left join public.studio_favorites f
 on f.organization_id=r.organization_id and f.user_id=auth.uid() and f.source=r.source and f.record_id=r.id;
revoke all on public.searchable_records,public.personal_search_results from public,anon,authenticated;
grant select on public.searchable_records,public.personal_search_results to authenticated;

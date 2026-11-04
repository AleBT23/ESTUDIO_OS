insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('finance-receipts','finance-receipts',false,2097152,array['application/pdf','image/jpeg','image/png']);
alter table public.finance_entries add unique(organization_id,id);
create table public.finance_receipts(
 id uuid primary key, organization_id uuid not null, entry_id uuid not null,
 filename text not null check(length(trim(filename)) between 1 and 180),
 mime text not null check(mime in ('application/pdf','image/png','image/jpeg')),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),size_bytes integer not null check(size_bytes between 1 and 2097152),
 storage_path text generated always as (organization_id::text||'/'||entry_id::text||'/'||sha256) stored unique,
 created_at timestamptz not null default now(),
 foreign key(organization_id,entry_id) references public.finance_entries(organization_id,id)
);
alter table public.finance_receipts enable row level security;
revoke all on public.finance_receipts from public,anon,authenticated;
grant select on public.finance_receipts to authenticated;
grant insert(id,organization_id,entry_id,filename,mime,sha256,size_bytes) on public.finance_receipts to authenticated;
create policy receipt_finance on public.finance_receipts for all to authenticated
using(private.has_role(organization_id,array['owner','admin']::public.member_role[]))
with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));

create policy receipt_object_read on storage.objects for select to authenticated using(bucket_id='finance-receipts' and exists(select 1 from public.finance_receipts r where r.storage_path=name));
create policy receipt_object_insert on storage.objects for insert to authenticated with check(bucket_id='finance-receipts' and exists(select 1 from public.finance_receipts r where r.storage_path=name));
create policy receipt_object_read_limit on storage.objects as restrictive for select to authenticated using(bucket_id<>'finance-receipts' or exists(select 1 from public.finance_receipts r where r.storage_path=name));
create policy receipt_object_insert_limit on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'finance-receipts' or exists(select 1 from public.finance_receipts r where r.storage_path=name));
create policy receipt_object_no_update on storage.objects as restrictive for update to authenticated using(bucket_id<>'finance-receipts') with check(bucket_id<>'finance-receipts');
create policy receipt_object_no_delete on storage.objects as restrictive for delete to authenticated using(bucket_id<>'finance-receipts');
create policy receipt_object_no_anon on storage.objects as restrictive for all to anon using(bucket_id<>'finance-receipts') with check(bucket_id<>'finance-receipts');
create view public.available_receipts with(security_invoker=true) as
select r.* from public.finance_receipts r join storage.objects o on o.bucket_id='finance-receipts' and o.name=r.storage_path;
revoke all on public.available_receipts from public,anon,authenticated;
grant select on public.available_receipts to authenticated;

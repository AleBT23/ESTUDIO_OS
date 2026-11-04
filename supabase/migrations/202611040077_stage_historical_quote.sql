create table public.legacy_proposal_archive (
  organization_id uuid not null references public.organizations(id),
  legacy_id text not null check(length(btrim(legacy_id)) between 1 and 160),
  folio text not null check(length(btrim(folio)) between 1 and 160),
  client_id uuid,
  payload jsonb not null,
  source_checksum text not null check(source_checksum ~ '^[0-9a-f]{64}$'),
  settings_currency text check(length(settings_currency) between 1 and 20),
  imported_at timestamptz not null default now(),
  primary key(organization_id,legacy_id),
  foreign key(organization_id,client_id) references public.clients(organization_id,id)
);
alter table public.legacy_proposal_archive enable row level security;
revoke all on public.legacy_proposal_archive from public,anon,authenticated;
grant select on public.legacy_proposal_archive to authenticated;
create policy archive_owner_read on public.legacy_proposal_archive for select to authenticated
using(private.has_role(organization_id,array['owner']::public.member_role[]));

create function public.stage_historical_quote(org uuid,item jsonb,checksum text,currency_setting text) returns text
language plpgsql security definer set search_path='' as $$
declare
  original text:=item->>'id'; link uuid; stored public.legacy_proposal_archive;
begin
  if not private.has_role(org,array['owner']::public.member_role[]) or not exists(
    select 1 from private.legacy_staging_targets where organization_id=org
  ) then raise exception 'Destino de staging no habilitado' using errcode='42501'; end if;
  if not coalesce(jsonb_typeof(item->'id')='string' and jsonb_typeof(item->'proposalNumber')='string'
    and jsonb_typeof(item->'items')='array' and octet_length(item::text)<=4000000,false)
  then raise exception 'Propuesta inválida';end if;
  if nullif(item->>'clientId','') is not null then
    select id into link from public.clients where organization_id=org and legacy_id=item->>'clientId';
  end if;
  insert into public.legacy_proposal_archive(organization_id,legacy_id,folio,client_id,payload,source_checksum,settings_currency)
    values(org,original,item->>'proposalNumber',link,item,checksum,currency_setting)
    on conflict(organization_id,legacy_id) do nothing;
  if found then return 'inserted';end if;
  select * into strict stored from public.legacy_proposal_archive where organization_id=org and legacy_id=original;
  if stored.payload is distinct from item or stored.settings_currency is distinct from currency_setting
  then raise exception 'La propuesta archivada tiene datos distintos';end if;
  return 'unchanged';
end $$;
revoke all on function public.stage_historical_quote(uuid,jsonb,text,text) from public,anon;
grant execute on function public.stage_historical_quote(uuid,jsonb,text,text) to authenticated;

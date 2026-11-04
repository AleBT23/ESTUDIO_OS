create or replace function private.guard_quote_archive() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.deleted_at is not null and new.deleted_at is null and (to_jsonb(old) - 'deleted_at') = (to_jsonb(new) - 'deleted_at') then return new; end if;
 if old.deleted_at is not null then
  raise exception 'La cotización está eliminada; no admite operaciones comerciales' using errcode='PQ002';
 end if;
 if new.deleted_at is not null and (
  old.status='accepted' or exists(
   select 1 from public.projects p join public.quote_versions v on v.id=p.quote_version_id
   where v.organization_id=old.organization_id and v.quote_id=old.id
  )
 ) then
  raise exception 'Conserva la cotización vinculada al proyecto y sus obligaciones' using errcode='PQ001';
 end if;
 return new;
end $$;
create function public.restore_quote(org uuid, quote uuid, expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then
   raise exception 'Permisos insuficientes' using errcode='42501';
 end if;
 update public.quotes set deleted_at=null where organization_id=org and id=quote
   and version=expected_version and deleted_at is not null;
 if not found then raise exception 'La cotización cambió o ya fue restaurada' using errcode='PQ002'; end if;
end $$;
revoke all on function public.restore_quote(uuid,uuid,integer) from public,anon;
grant execute on function public.restore_quote(uuid,uuid,integer) to authenticated;

create function public.set_studio_document_archived(org uuid, document uuid, expected_version integer, archive boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(org,array['owner','admin']::public.member_role[]) then raise exception 'Permisos insuficientes'; end if;
 update public.studio_documents
 set deleted_at=case when archive then clock_timestamp() end
 where organization_id=org and id=document and version=expected_version and (deleted_at is null)=archive;
 if not found then raise exception 'Documento o versión no disponible'; end if;
end $$;
revoke all on function public.set_studio_document_archived(uuid,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.set_studio_document_archived(uuid,uuid,integer,boolean) to authenticated;

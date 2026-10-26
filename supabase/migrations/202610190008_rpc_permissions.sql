-- Supabase puede conceder EXECUTE a anon mediante privilegios predeterminados.
-- REVOKE FROM PUBLIC no retira esas concesiones explícitas. Solo RPCs propias.
revoke execute on function public.create_workspace(text) from public,anon;
revoke execute on function public.save_preset(uuid,uuid,integer,text,text,jsonb) from public,anon;
revoke execute on function public.save_quote_draft(uuid,uuid,integer,jsonb,jsonb) from public,anon;
revoke execute on function public.prepare_quote_version(uuid,uuid,integer,jsonb) from public,anon;
revoke execute on function public.finalize_quote_version(uuid,uuid,text) from public,anon;
revoke execute on function public.mark_quote_sent(uuid,uuid,integer,uuid) from public,anon;
revoke execute on function public.accept_quote(uuid,uuid,integer,date,date) from public,anon;
revoke execute on function public.record_payment(uuid,uuid,bigint,date,text,uuid) from public,anon;
revoke execute on function public.reverse_payment(uuid,uuid,integer,text) from public,anon;
revoke execute on function public.change_quote_lifecycle(uuid,uuid,integer,text,text,date) from public,anon;
revoke execute on function public.save_studio_document(uuid,uuid,integer,jsonb) from public,anon;
revoke execute on function public.prepare_studio_document(uuid,uuid,integer) from public,anon;
revoke execute on function public.finalize_studio_document(uuid,uuid,text) from public,anon;
revoke execute on function private.has_role(uuid,public.member_role[]) from public,anon;
revoke execute on function private.document_object_access(text,boolean) from public,anon;

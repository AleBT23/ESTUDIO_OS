create table public.member_role_changes (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,member_id uuid not null,
 old_role public.member_role not null,new_role public.member_role not null,
 actor_id uuid not null default auth.uid() references auth.users(id),changed_at timestamptz not null default clock_timestamp(),
 foreign key(organization_id,member_id) references public.memberships(organization_id,user_id)
);
alter table public.member_role_changes enable row level security;
revoke all on public.member_role_changes from public,anon,authenticated;
grant select on public.member_role_changes to authenticated;
create policy owner_history on public.member_role_changes for select to authenticated using(private.has_role(organization_id,array['owner']::public.member_role[]));
create index member_role_changes_history on public.member_role_changes(organization_id,changed_at desc,id);
create function public.change_studio_member_role(org uuid,member uuid,expected public.member_role,desired public.member_role)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(org,array['owner']::public.member_role[]) then raise exception 'Permisos insuficientes'; end if;
 if member=auth.uid() or expected='owner' or desired='owner' or desired is null or desired=expected then raise exception 'Cambio de rol no permitido'; end if;
 update public.memberships set role=desired where organization_id=org and user_id=member and role=expected and role<>'owner';
 if not found then raise exception 'El miembro o su rol cambiaron'; end if;
 insert into public.member_role_changes(organization_id,member_id,old_role,new_role)
 values(org,member,expected,desired);
end $$;
revoke all on function public.change_studio_member_role(uuid,uuid,public.member_role,public.member_role) from public,anon;
grant execute on function public.change_studio_member_role(uuid,uuid,public.member_role,public.member_role) to authenticated;

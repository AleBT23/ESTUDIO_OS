create table public.studio_invitations(
 id uuid primary key,organization_id uuid not null references public.organizations(id),
 email text not null check(email=lower(trim(email)) and length(email) between 3 and 254 and position('@' in email)>1),
 role public.member_role not null check(role<>'owner'),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (now()+interval '7 days'),
 status text not null default 'pending' check(status in ('pending','accepted','revoked')),
 accepted_by uuid references auth.users(id),resolved_at timestamptz
);
create unique index studio_invitation_pending on public.studio_invitations(organization_id,email) where status='pending';
create index studio_invitation_email on public.studio_invitations(email,expires_at) where status='pending';
alter table public.studio_invitations enable row level security;
revoke all on public.studio_invitations from public,anon,authenticated;
grant select,insert(id,organization_id,email,role) on public.studio_invitations to authenticated;
create policy invitation_owner on public.studio_invitations for all to authenticated
 using(private.has_role(organization_id,array['owner']::public.member_role[]))
 with check(private.has_role(organization_id,array['owner']::public.member_role[]));

create function public.my_studio_invitations()
returns table(id uuid,studio text,role public.member_role,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
 select i.id,o.name,i.role,i.expires_at from public.studio_invitations i
 join public.organizations o on o.id=i.organization_id
 join auth.users u on u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=i.email
 where i.status='pending' and i.expires_at>now() order by i.created_at desc,i.id
$$;

create function public.accept_studio_invitation(invitation uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.studio_invitations;
begin
 if auth.uid() is null then raise exception 'Se requiere iniciar sesión'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select s.* into i from public.studio_invitations s join auth.users u
 on u.id=auth.uid() and u.email_confirmed_at is not null and lower(u.email)=s.email
 where s.id=invitation for update of s;
 if i.status='accepted' and i.accepted_by=auth.uid() then return i.organization_id; end if;
 if i.id is null or i.status<>'pending' or i.expires_at<=clock_timestamp() then raise exception 'Invitación no disponible'; end if;
 if exists(select 1 from public.memberships where user_id=auth.uid()) then raise exception 'Ya perteneces a un estudio'; end if;
 insert into public.memberships(organization_id,user_id,role) values(i.organization_id,auth.uid(),i.role);
 update public.studio_invitations set status='accepted',accepted_by=auth.uid(),resolved_at=clock_timestamp() where id=i.id;
 return i.organization_id;
end $$;
create function public.revoke_studio_invitation(org uuid,invitation uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(org,array['owner']::public.member_role[]) then raise exception 'Permisos insuficientes'; end if;
 update public.studio_invitations set status='revoked',resolved_at=clock_timestamp() where organization_id=org and id=invitation and status='pending';
 if not found then raise exception 'La invitación ya se resolvió'; end if;
end $$;
revoke all on function public.my_studio_invitations(),public.accept_studio_invitation(uuid),public.revoke_studio_invitation(uuid,uuid) from public,anon;
grant execute on function public.my_studio_invitations(),public.accept_studio_invitation(uuid),public.revoke_studio_invitation(uuid,uuid) to authenticated;

create view public.studio_invitation_history with(security_invoker=true) as
select id,organization_id,email,role,created_at,expires_at,status,
 status='pending' and expires_at<=now() expired from public.studio_invitations;
revoke all on public.studio_invitation_history from public,anon,authenticated;
grant select on public.studio_invitation_history to authenticated;

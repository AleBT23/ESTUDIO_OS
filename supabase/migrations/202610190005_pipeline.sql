create table public.opportunities(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),client_id uuid not null,business_line_id uuid not null,
 name text not null check(char_length(name) between 2 and 160),stage text not null default 'new' check(stage in ('new','contact','proposal','negotiation','won','lost')),
 notes text not null default '' check(char_length(notes)<=10000),next_follow_up date,
 version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,
 unique(organization_id,id),foreign key(organization_id,client_id) references public.clients(organization_id,id),foreign key(organization_id,business_line_id) references public.business_lines(organization_id,id)
);
create index opportunities_stage on public.opportunities(organization_id,stage,business_line_id,deleted_at);
create index opportunities_follow_up on public.opportunities(organization_id,next_follow_up) where deleted_at is null and stage not in ('won','lost');
alter table public.opportunities enable row level security;
revoke all on public.opportunities from public,anon,authenticated;
grant select,insert on public.opportunities to authenticated;
grant update(client_id,business_line_id,name,stage,notes,next_follow_up,deleted_at) on public.opportunities to authenticated;
create policy commercial_read on public.opportunities for select to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy commercial_insert on public.opportunities for insert to authenticated with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create policy commercial_update on public.opportunities for update to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[])) with check(private.has_role(organization_id,array['owner','admin']::public.member_role[]));
create trigger opportunities_track before insert or update on public.opportunities for each row execute function private.track_change();

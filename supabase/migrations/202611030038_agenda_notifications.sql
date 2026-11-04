create table public.agenda_notification_reads (
 organization_id uuid not null, user_id uuid not null default auth.uid(),
 kind text not null, event_id uuid not null, due_on date not null,
 read_at timestamptz not null default now(),
 primary key(organization_id,user_id,kind,event_id,due_on),
 foreign key(organization_id,user_id) references public.memberships(organization_id,user_id) on delete cascade
);
alter table public.agenda_notification_reads enable row level security;
revoke all on public.agenda_notification_reads from public,anon,authenticated;
grant select,delete,insert(organization_id,kind,event_id,due_on) on public.agenda_notification_reads to authenticated;
create policy read_own on public.agenda_notification_reads for select to authenticated using(user_id=auth.uid());
create policy undo_own on public.agenda_notification_reads for delete to authenticated using(user_id=auth.uid());
create policy acknowledge_visible on public.agenda_notification_reads for insert to authenticated with check(
 user_id=auth.uid() and exists(select 1 from public.agenda_events e join public.organizations o on o.id=e.organization_id
 where e.organization_id=agenda_notification_reads.organization_id and e.kind=agenda_notification_reads.kind
 and e.id=agenda_notification_reads.event_id and e.due_on=agenda_notification_reads.due_on
 and e.due_on<=(now() at time zone o.timezone)::date));
create view public.agenda_notifications with(security_invoker=true) as
 select e.*,r.read_at from public.agenda_events e join public.organizations o on o.id=e.organization_id
 left join public.agenda_notification_reads r on r.organization_id=e.organization_id and r.user_id=auth.uid()
 and r.kind=e.kind and r.event_id=e.id and r.due_on=e.due_on
 where e.due_on<=(now() at time zone o.timezone)::date;
revoke all on public.agenda_notifications from public,anon,authenticated;
grant select on public.agenda_notifications to authenticated;

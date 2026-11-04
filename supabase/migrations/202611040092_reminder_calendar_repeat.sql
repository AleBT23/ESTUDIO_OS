alter table public.personal_reminders
  add column priority text not null default 'normal' check(priority in ('low','normal','high')),
  add column repeat_months integer not null default 0 check(repeat_months between 0 and 12),
  add column anchor_day integer check(anchor_day between 1 and 31),
  add check(repeat_days=0 or repeat_months=0);
grant insert(priority,repeat_months,anchor_day),update(priority,repeat_months) on public.personal_reminders to authenticated;

create or replace function private.advance_personal_reminder() returns trigger language plpgsql
set search_path='' as $$
declare next_due date; first_next date;
begin
 if tg_op='UPDATE' then
   if old.completed then raise exception 'El recordatorio ya se completó';end if;
   new.version:=old.version+1;
   if new.due_on<>old.due_on then new.anchor_day:=null;end if;
 end if;
 if new.repeat_months>0 then
   new.anchor_day:=coalesce(new.anchor_day,extract(day from new.due_on)::int);
 else new.anchor_day:=null;
 end if;
 if tg_op='UPDATE' and new.completed then
   if new.repeat_months>0 then
     first_next:=(date_trunc('month',new.due_on)+make_interval(months=>new.repeat_months))::date;
     next_due:=least(first_next+new.anchor_day-1,(first_next+interval '1 month')::date-1);
   elsif new.repeat_days>0 then next_due:=new.due_on+new.repeat_days;
   end if;
   if next_due is not null then
     insert into public.personal_reminders(organization_id,label,due_on,repeat_days,repeat_months,anchor_day,priority)
     values(new.organization_id,new.label,next_due,new.repeat_days,new.repeat_months,new.anchor_day,new.priority);
   end if;
 end if;
 return new;
end $$;
create trigger initialize_reminder before insert on public.personal_reminders
for each row execute function private.advance_personal_reminder();

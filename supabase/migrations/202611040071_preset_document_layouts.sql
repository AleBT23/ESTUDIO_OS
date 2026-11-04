create table public.sales_document_layouts(
 organization_id uuid not null,preset_id uuid,quote_id uuid,options jsonb,
 unique(organization_id,preset_id),unique(organization_id,quote_id),
 check(num_nonnulls(preset_id,quote_id)=1),
 foreign key(organization_id,preset_id) references public.service_presets(organization_id,id),
 foreign key(organization_id,quote_id) references public.quotes(organization_id,id)
);
alter table public.sales_document_layouts enable row level security;
revoke all on public.sales_document_layouts from public,anon,authenticated;
grant select on public.sales_document_layouts to authenticated;
create policy layout_read on public.sales_document_layouts for select to authenticated using(private.has_role(organization_id,array['owner','admin']::public.member_role[]));

create function private.validate_sales_layout(org uuid,layout jsonb) returns void language plpgsql set search_path='' as $$
declare sections text[];m jsonb;
begin
 if layout is null then return;end if;
 select array_agg(s) into sections from jsonb_array_elements_text(layout->'sections') s;
 m:=layout->'margins';
 if not coalesce(cardinality(sections) between 1 and 6 and sections @> array['budget'] and sections <@ array['cover','thanks','scope','budget','conditions','acceptance']
 and (select count(distinct s) from unnest(sections) s)=cardinality(sections)
 and (m->>'top')::numeric between 22 and 60 and (m->>'bottom')::numeric between 26 and 60
 and (m->>'left')::numeric between 12 and 45 and (m->>'right')::numeric between 24 and 50,false) then raise exception 'Opciones de PDF inválidas';end if;
 if layout ? 'letterhead_revision' and not exists(select 1 from public.library_revisions where organization_id=org and id=(layout->>'letterhead_revision')::uuid and attachment is not null)
 then raise exception 'Membrete no disponible';end if;
end $$;
revoke all on function private.validate_sales_layout(uuid,jsonb) from public,anon,authenticated;

create function public.save_preset_with_layout(org uuid,preset uuid,expected_version integer,preset_name text,preset_notes text,items jsonb,preset_conditions text,layout jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 target:=public.save_preset_terms(org,preset,expected_version,preset_name,preset_notes,items,preset_conditions);
 perform private.validate_sales_layout(org,layout);
 insert into public.sales_document_layouts(organization_id,preset_id,options) values(org,target,layout)
 on conflict(organization_id,preset_id) do update set options=excluded.options;
 return target;
end $$;

create function public.save_quote_with_layout(org uuid,quote uuid,expected_version integer,header jsonb,items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;layout jsonb:=nullif(header->'document_layout','null'::jsonb);
begin
 target:=public.save_quote_draft(org,quote,expected_version,header,items);
 if header ? 'document_layout' then
   perform private.validate_sales_layout(org,layout);
   insert into public.sales_document_layouts(organization_id,quote_id,options) values(org,target,layout)
   on conflict(organization_id,quote_id) do update set options=excluded.options;
 end if;
 return target;
end $$;
revoke all on function public.save_preset_with_layout(uuid,uuid,integer,text,text,jsonb,text,jsonb),public.save_quote_with_layout(uuid,uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.save_preset_with_layout(uuid,uuid,integer,text,text,jsonb,text,jsonb),public.save_quote_with_layout(uuid,uuid,integer,jsonb,jsonb) to authenticated;
create view public.preset_specs with(security_invoker=true) as
select p.*,l.options document_layout from public.service_presets p left join public.sales_document_layouts l on l.organization_id=p.organization_id and l.preset_id=p.id;
revoke all on public.preset_specs from public,anon,authenticated;
grant select on public.preset_specs to authenticated;

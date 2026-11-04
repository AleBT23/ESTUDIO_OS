-- Instantánea operativa. Las políticas de cada tabla también se aplican al exportar.
create function public.export_workspace(org uuid, section_name text default 'todo')
returns text language plpgsql stable security invoker set search_path='' as $$
declare
  module record;
  relation_name text;
  columns_sql text;
  source_sql text;
  entry text;
  records text[];
  datasets text[] := '{}';
  used_bytes bigint := 0;
  included integer := 0;
begin
  if not private.has_role(org,array['owner']::public.member_role[]) then
    raise exception 'Se requiere el propietario' using errcode='42501';
  end if;
  for module in select * from (values
    ('comercial',array['business_lines','clients','client_contacts','opportunities','opportunity_interactions','services','service_categories','concepts','service_presets','preset_items','quotes','quote_items','quote_versions','quote_status_events','sales_document_layouts','contracts']),
    ('proyectos',array['projects','project_service_packages','phase_templates','project_phase_plans','project_notes','task_subtasks','project_observations','project_photos','project_time','time_corrections','project_deliverables','deliverable_revisions','scope_changes','portal_deliveries']),
    ('obras',array['works','work_budget_items','work_estimates','work_resource_usage','journal_entries']),
    ('finanzas',array['finance_cases','finance_entries','finance_receipts','payment_schedules','payments','schedule_changes','schedule_cancellations','case_invoices','package_financials','suppliers','collaborator_fees','member_cost_rates']),
    ('recursos',array['document_templates','studio_documents','generated_documents','library_revisions','studio_procedures','procedure_runs','procedure_checks','dossier_files','editorial_items'])
  ) m(label,relations) where section_name in ('todo',m.label)
  loop
    foreach relation_name in array module.relations loop
      -- Select individual readable columns so that binary attachments are never serialized.
      select string_agg(format('%I',a.attname),', ' order by a.attnum) into columns_sql
        from pg_catalog.pg_attribute a
        where a.attrelid=format('public.%I',relation_name)::regclass and a.attnum>0 and not a.attisdropped
        and a.atttypid<>'bytea'::regtype and has_column_privilege(a.attrelid,a.attname,'SELECT');
      if columns_sql is null then raise exception 'Colección no disponible: %',relation_name;end if;
      source_sql:=format('select %s from public.%I where organization_id=$1',columns_sql,relation_name);
      if relation_name='time_corrections' then
        source_sql:='select t.organization_id,c.time_id,c.version,c.corrected_at,c.actor_id,c.previous_values
          from public.time_corrections c join public.project_time t on t.id=c.time_id where t.organization_id=$1';
      end if;
      records:='{}';
      for entry in execute format('select row_to_json(r)::text from (%s) r',source_sql) using org loop
        used_bytes:=used_bytes+octet_length(entry)+1;
        if used_bytes>3500000 then raise exception 'Exportación demasiado grande' using errcode='54000';end if;
        records:=array_append(records,entry);
      end loop;
      datasets:=array_append(datasets,format('%s:{"count":%s,"rows":[%s]}',to_json(relation_name),cardinality(records),array_to_string(records,',')));
      included:=included+1;
    end loop;
  end loop;
  if included=0 then raise exception 'Sección desconocida' using errcode='22023';end if;
  return format('{"format":"estudio-os-workspace","version":1,"organization_id":%s,"section":%s,"exported_at":%s,"collections":{%s}}',
    to_json(org),to_json(section_name),to_json(statement_timestamp()),array_to_string(datasets,','));
end $$;
revoke all on function public.export_workspace(uuid,text) from public,anon;
grant execute on function public.export_workspace(uuid,text) to authenticated;

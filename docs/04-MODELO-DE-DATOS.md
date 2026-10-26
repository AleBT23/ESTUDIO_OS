# 04 — Modelo lógico de datos

## Convenciones
PostgreSQL; PK UUID; `created_at`, `updated_at`; `organization_id` para aislamiento de datos; `deleted_at` cuando aplique; importes `numeric(18,2)` o enteros de centavos (decisión única); claves foráneas e índices. `business_line_id` configurable y opcional solo en entidades verdaderamente transversales.

## Entidades sugeridas
- `organizations`, `users`, `memberships`, `roles`, `business_lines`, `organization_settings`.
- `clients`, `client_contacts`, `leads`, `opportunities`, `interactions`, `follow_ups`.
- `service_categories`, `services`, `service_presets`, `preset_items`, `preset_document_sections`.
- `quotes`, `quote_versions`, `quote_items`, `quote_status_events`, `quote_attachments`.
- `letterheads`, `document_templates`, `template_versions`, `document_sections`, `generated_documents`.
- `projects`, `project_service_packages`, `phase_templates`, `project_phases`, `tasks`, `task_dependencies`, `deliverables`, `deliverable_revisions`, `change_requests`.
- `payment_schedules`, `payments`, `expenses`, `vendors`, `collaborators`, `fee_allocations`, `collaborator_payments`, `time_entries`.
- `library_items`, `library_tags`, `library_item_tags`, `procedures`, `checklists`, `checklist_items`.
- `content_ideas`, `content_posts`, `portfolio_items`, `campaign_sources`.
- `files`, `audit_events`, `notifications`, `import_jobs`.

## Relaciones obligatorias
- Cliente 1:N oportunidades, presupuestos y proyectos.
- Presupuesto 1:N versiones; versión 1:N partidas; cada versión guarda snapshot completo y referencia a PDF generado.
- Proyecto 1:N paquetes; paquete N:1 línea de negocio y opcional N:1 versión de cotización.
- Paquete 1:N fases, tareas, entregables, gastos y registros de tiempo.
- Solicitud de cambio N:1 paquete; opcionalmente genera presupuesto complementario.
- Cobro N:1 plan de pago o proyecto; gasto N:1 proyecto/paquete según corresponda.
- Plantilla documental 1:N versiones; documento generado conserva referencia y contenido renderizado.

## Integridad
- Todas las consultas de datos del despacho filtran por `organization_id` y aplican políticas RLS si se usa Supabase.
- No permitir que una fila de una organización referencie otra organización.
- IDs del legado se preservan como `legacy_id` cuando proceda.
- Definir índices para cliente, estado, fecha, línea de negocio, proyecto y búsqueda.
- Documentar restricciones de unicidad de folios por organización y año.

## Trabajo para Codex
Producir diagrama ERD en Mermaid, migraciones SQL y pruebas de integridad referencial antes de cargar datos reales. Resolver tablas definitivas según implementación, sin sacrificar relaciones aquí especificadas.

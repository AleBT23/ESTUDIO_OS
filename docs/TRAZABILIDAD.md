# Requisitos y evidencia

19 de octubre de 2026. **Ningún bloque integral está aceptado todavía**: falta conexión real Supabase, E2E autenticado y validación del propietario. “Implementado” aquí describe código/migraciones/pruebas locales, nunca datos productivos ni despliegue.

| Requisito | Estado y evidencia | Pendiente |
| --- | --- | --- |
| DASH-01, DASH-02 | Pendiente; Inicio es bienvenida honesta | KPIs, periodos, filtro global persistente y atribución consolidada |
| DASH-03 | Pendiente | Búsqueda global, favoritos, actividad consolidada y crear global |
| CRM-01 | Parcial: clientes/contactos/notas/origen, búsqueda/paginación, archivo y auditoría; src/modules/crm, database.test | Adjuntos y expediente vinculado completo; E2E real |
| CRM-02 | Parcial: pipeline seis etapas, notas y fecha de seguimiento, señales vencidas; pipeline-schema y database.test | Historial detallado de interacciones y notificaciones persistentes |
| QUO-01 | Parcial: catálogo editable, línea, costo/precio, vigencia, archivo, clave única | Categorías como catálogo normalizado; E2E |
| QUO-02 | Parcial: presets con servicios/cantidades/notas, copia editable en propuesta | Condiciones/documentos/secciones configurables por preset |
| QUO-03 | Parcial: partidas, cantidades, descuentos, IVA, anticipo, vigencia, condiciones; cálculo servidor y SQL coinciden | Multimoneda solo tras reglas explícitas; UI principal contra Supabase |
| QUO-04 | Parcial: borrador, emisión/snapshot/PDF, envío manual, aceptación, rechazo/vencimiento y revisión con motivo e historial; snapshots anteriores inmutables | E2E remoto y aceptación del usuario |
| QUO-05 | Parcial: aceptación crea proyecto/paquetes/plan atómicamente; prueba 25,000/50%/cobrado cero | Fases/tareas desde plantillas al convertir; E2E remoto |
| QUO-06 | Parcial: seis unidades, porcentaje corregido, horas/costos externos previstos, resultado/margen e ingreso por hora exactos y fórmulas visibles | Atribución completa de costos por partida, tarifas para costo imputado de horas y E2E |
| MKT-01 | Pendiente | Ideas, calendario, canales, publicaciones/resultados y portafolio |
| PRJ-01 | Parcial: expediente con cliente, fecha de inicio, estado y vínculo a versión | Edición de ubicación/fechas/responsables, documentos y enlaces |
| PRJ-02 | Parcial: paquetes mixtos de una cotización, alcance y presupuesto neto por línea segregado | Edición de paquetes y continuidad completa |
| PRJ-03 | Pendiente | Plantillas editables/fases y aplicación a proyectos |
| TASK-01 | Pendiente | Tareas/subtareas, responsables, prioridades, dependencias y tres vistas |
| DEL-01 | Pendiente | Entregables, archivos, revisiones y aprobaciones |
| CHG-01 | Pendiente | Impacto, aprobación, extra y alcance trazable |
| FIN-01 | Parcial: obligaciones, pago efectivo, saldo, idempotencia, no sobrepago, reverso auditado; SQL y UI | Editor de planes/parcialidades/cancelaciones, recibos y E2E |
| FIN-02 | Pendiente | Gastos/categorías/proveedores/comprobantes y atribución |
| FIN-03 | Pendiente | Colaboradores/reglas/repartos y pagos |
| TIME-01 | Pendiente | Tiempo por usuario/paquete/tarea y corrección |
| PROF-01 | Pendiente | Estimación y rentabilidad real con fórmulas/costo horas separado |
| REP-01 | Pendiente | Reportes filtrables y CSV |
| DOC-01 | Parcial: motor de variables con lista blanca, sintaxis/missing-data y sustitución no recursiva probados; documentos con párrafos/subtítulos/listas/saltos | Plantillas reutilizables versionadas, tablas/imágenes y contexto de cotización integrado en editor |
| DOC-02 | Parcial: PNG real carta, proporción preservada, márgenes seguros y preview PDF | Membretes múltiples privados/carga, aviso de proporción/ajuste y guías visuales |
| DOC-03 | Parcial: seis secciones opcionales/reordenables, presupuesto obligatorio; Unicode, 1/12 páginas, encabezado repetido y firmas; pdf.test | Personalización de textos/plantillas/anexos y escenarios extremos de contenido |
| DOC-04 | Parcial: cartas/oficios/minutas/reportes, borradores guardados, contexto cliente/proyecto opcional, márgenes, preview y emisión/descarga/versiones privadas sin presupuesto | E2E remoto; tablas/imágenes/adjuntos; archivo recuperable del documento |
| LIB-01, SOP-01 | Pendiente | Biblioteca técnica/BIM/adjuntos/versiones, procedimientos/checklists |
| CORE-01 | Parcial: Supabase SSR, roles, RLS y autorización servidor probados SQL | Credenciales y E2E Auth, invitaciones/roles editables, revisión de acceso por proyecto |
| CORE-02 | Parcial: auditoría, versiones, archivo de clientes/contactos/servicios, reversos de cobro | Completar recuperación en restantes entidades |
| CORE-03 | Parcial: exportador legado/validador SHA-256, migrador con checksums | Importación staging/reconciliación, backups BD/archivos, exportación general y restauración ensayada |
| CORE-04 | Parcial: fecha/señal de seguimiento sin duplicar calendario | Centro persistente de notificaciones/recordatorios y proveedor/jobs |
| CORE-05 | Parcial: shell responsive, formularios, foco/reduced-motion; E2E móvil | E2E de formularios autenticados y accesibilidad ampliada |

## Hitos
- A: PDF con PNG real probado con fixture sintético; **presets reales no migrados**. No aceptado.
- B: prueba SQL correcta de propuesta emitida/enviada/aceptada → proyecto mixto → obligaciones sin cobro automático. Falta flujo UI real y aceptación.
- C: presupuesto neto de paquetes atribuido a líneas; gastos/horas/ingresos reales por paquete pendientes.
- D, E: pendientes.
- F: minuta independiente de 1 página y reporte de visita de 3 páginas generados, reabiertos y revisados visualmente con PNG real; persistencia/versiones/Storage verificadas en PostgreSQL de pruebas. Falta E2E remoto/aceptación.

## Secuencia para retomar
1. El usuario confirmó que no tiene Supabase y autorizó continuar preparación. Conexión/migraciones/E2E remoto quedan pendientes, sin bloquear código y pruebas independientes; no tocar navegador original.
2. Completar Comercial (presets documentales y archivos) y Documentos (plantillas reutilizables, tablas/imágenes, membretes múltiples). Conceptos, estimación de honorarios y estados/revisiones ya preparados y probados localmente.
3. Producción completa; después Administración completa. Continuar Recursos/Marketing, Inicio/analítica y migración/hardening final conforme al roadmap. No dejar estos módulos fuera del alcance.

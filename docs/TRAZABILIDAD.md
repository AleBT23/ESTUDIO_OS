# Requisitos y evidencia

**4 de noviembre de 2026.** Las pruebas locales y el historial de producción se documentan por separado. Supabase tiene diez migraciones registradas. La aceptación de la rama requiere un recorrido autenticado en staging y validación con el propietario.

| Requisito | Estado y evidencia | Pendiente |
| --- | --- | --- |
| DASH-01, DASH-02 | Inicio muestra cartera, flujo por periodo y línea, pendientes vencidos y entregas próximas | Filtro global persistente y conciliación autenticada |
| DASH-03 | Implementado localmente | Búsqueda global, favoritos personales (039), actividad reciente (040) y captura desde el menú por rol. Pendiente preview autenticada. |
| CRM-01 | Parcial: clientes/contactos/notas/origen, búsqueda/paginación, archivo y auditoría; src/modules/crm, database.test | Adjuntos y enlaces (060), proyectos, propuestas y obras relacionados (066). Pendiente recorrido autenticado del expediente |
| CRM-02 | Parcial: pipeline seis etapas, notas y fecha de seguimiento, señales vencidas; pipeline-schema y database.test | Historial paginado de interacciones (072). Pendiente validar seguimiento y notificaciones con sesión aislada |
| QUO-01 | Parcial: catálogo editable, línea, costo/precio, vigencia, archivo, clave única | Categorías normalizadas por despacho (073). Pendiente E2E autenticado |
| QUO-02 | Parcial: presets con servicios/cantidades/notas, copia editable en propuesta | Condiciones reutilizables y retrocompatibilidad verificadas en 061. Diseño de secciones, márgenes y membrete copiado al borrador (071). Pendiente recorrido autenticado |
| QUO-03 | Parcial: partidas, cantidades, descuentos, IVA, anticipo, vigencia, condiciones; cálculo servidor y SQL coinciden | Multimoneda solo tras reglas explícitas; UI principal contra Supabase |
| QUO-04 | Parcial: borrador, emisión/snapshot/PDF, envío manual, aceptación, rechazo/vencimiento y revisión con motivo e historial; snapshots anteriores inmutables | E2E remoto y aceptación del usuario |
| QUO-05 | Parcial: aceptación crea proyecto/paquetes/plan atómicamente; prueba 25,000/50%/cobrado cero | Fases por línea aplicadas al convertir (065). Tareas copiadas al tablero (074). Pendiente recorrido remoto |
| QUO-06 | Parcial: seis unidades, porcentaje corregido, horas/costos externos previstos, resultado/margen e ingreso por hora exactos y fórmulas visibles | Atribución completa de costos por partida, tarifas para costo imputado de horas y E2E |
| MKT-01 | Implementado localmente | Comercial → Marketing. Ideas, agenda por mes, canal, publicación, enlace, resultados y portafolio asociado a proyecto y oportunidad. Pendiente el recorrido autenticado en preview. |
| PRJ-01 | Parcial: expediente con cliente, ubicación, responsable, inicio, cierre en Agenda y vínculo a versión. Adjuntos privados y enlaces (059 y 060) | Recorrido autenticado de ficha y adjuntos |
| PRJ-02 | Parcial: paquetes mixtos de una cotización, alcance y presupuesto neto por línea segregado | Edición de paquetes y continuidad completa |
| PRJ-03 | Implementado localmente | Plantillas editables por línea o servicio y planes por proyecto. Arquitectura y visualización tienen fases iniciales distintas. Preview autenticada pendiente. |
| TASK-01 | Implementado localmente | Tareas con responsables, prioridades, fechas, recurrencias, subtareas y dependencia previa. Lista, calendario y tablero en Agenda. Pendiente preview autenticada. |
| DEL-01 | Entregables y revisiones fechadas con responsable, aprobación y publicación selectiva al portal (020, 027). | Recorrido autenticado con cuentas del estudio y del cliente. |
| CHG-01 | Solicitudes con impacto en días y cotización adicional vinculada. Aceptación transaccional de paquetes y obligaciones en el mismo proyecto (031). | Validación autenticada del ciclo de aprobación. |
| FIN-01 | Planes, saldos, pagos efectivos, reversos y reprogramación total o por parcialidades. Recibos PDF por movimiento de proyecto o acuerdo. Pruebas SQL de conservación y concurrencia, permisos y lectura del PDF. | Cancelación del saldo de planes con motivo y auditoría (063). Pendiente recorrido autenticado. |
| FIN-02 | Acuerdos y movimientos por área y origen de fondos, comprobantes privados, padrón de proveedores y estado de cuenta vinculado con pagos, reversos y saldo pendiente. | Categorías y pagos conciliados con flujo en 055. Falta verificar captura y exportación con sesión aislada. |
| FIN-03 | Honorarios por miembro y paquete, fijos o porcentuales, con saldo, pagos y comprobantes (029). Probado el límite concurrente de reparto. | Conciliación en preview. |
| TIME-01 | Implementado localmente | Captura y corrección versionada por usuario, proyecto, paquete y tarea. Historial paginado en expediente. Pendiente recorrido autenticado en preview. |
| PROF-01 | Presupuesto aceptado, margen previsto, cobrado y flujo por hora, margen sobre cobros propios. Las horas usan tarifa vigente por miembro y reportan minutos sin tarifa por separado (056). | Validar datos de referencia, indirectos y aceptación del reporte en preview. |
| REP-01 | Reportes de flujo y egresos por categoría con filtros de periodo, cliente, proyecto, obra, paquete y línea. CSV con centavos exactos. | Recorrido autenticado, descarga y conciliación con datos representativos. |
| DOC-01 | Parcial: motor de variables con lista blanca, sintaxis/missing-data y sustitución no recursiva probados; documentos con párrafos/subtítulos/listas/saltos | Tablas paginadas, imágenes, membretes y variables vinculadas a una versión emitida (069). Pendiente emisión autenticada. |
| DOC-02 | Parcial: PNG real carta, proporción preservada, márgenes seguros y preview PDF | Membretes privados por revisión en cartas y cotizaciones. Pendiente validar proporción y márgenes con los membretes reales. |
| DOC-03 | Parcial: seis secciones opcionales/reordenables, presupuesto obligatorio; Unicode, 1/12 páginas, encabezado repetido y firmas; pdf.test | Personalización de textos/plantillas/anexos y escenarios extremos de contenido |
| DOC-04 | Cartas, oficios, minutas y reportes con borradores, contexto, emisión y versiones privadas. Recursos permite archivar y recuperar documentos con auditoría y versión optimista (051). | Tablas e imágenes privadas incorporadas. Pendiente emisión autenticada. |
| LIB-01 | Implementado localmente | Biblioteca buscable, etiquetas, vínculos, revisiones inmutables y adjuntos privados de hasta 2 MiB por versión. Pendiente preview autenticada. |
| SOP-01 | Implementado localmente | Procedimientos reutilizables, ejecuciones independientes por proyecto y pasos reversibles. Preview autenticada pendiente. |
| CORE-01 | Supabase SSR, roles, RLS y cambio de rol auditado de miembros existentes por el propietario (057). Prueba de concesión y retiro de acceso financiero en SQL. | Invitaciones con caducidad y verificación de correo (058). Pendientes alcance por proyecto y validación autenticada con dos cuentas. |
| CORE-02 | Parcial: auditoría, versiones, archivo de clientes/contactos/servicios, reversos de cobro | Completar recuperación en restantes entidades |
| CORE-03 | Exportador legado con SHA-256, migraciones con checksums y respaldo real hasta 010. db:restore-test restaura en base vacía la estructura actual con datos sintéticos y comprueba saldos, documentos y RLS. | Revisión de JSON en navegador e importación transaccional de clientes en staging (068). Faltan catálogo y propuestas, exportación general y validación de la copia real actual con archivos de Storage. |
| CORE-04 | Agenda y avisos internos por usuario. Incluye seguimientos, vencimientos de acuerdos según saldo y recordatorios privados sin proyecto, con reprogramación y recurrencia (038, 048 y 049). | Verificación autenticada de punta a punta y evaluación del proveedor de notificaciones externas. |
| CORE-05 | Parcial: shell responsive, formularios, foco/reduced-motion; E2E móvil | E2E de formularios autenticados y accesibilidad ampliada |

## Hitos
- A: PDF con PNG real probado con fixture sintético; **presets reales no migrados**. No aceptado.
- B: prueba SQL correcta de propuesta emitida/enviada/aceptada → proyecto mixto → obligaciones sin cobro automático. Falta flujo UI real y aceptación.
- C: presupuesto neto de paquetes atribuido a líneas; gastos/horas/ingresos reales por paquete pendientes.
- D, E: pendientes.
- F: minuta independiente de 1 página y reporte de visita de 3 páginas generados, reabiertos y revisados visualmente con PNG real; persistencia/versiones/Storage verificadas en PostgreSQL de pruebas. Falta E2E remoto/aceptación.

## Secuencia para retomar
1. Contrastar el historial mediante `npm run db:plan` y repetir la restauración en una copia aislada actualizada, incluidos los objetos de Storage.
2. Ejecutar los recorridos autenticados del anticipo y del lector con `npm run test:e2e:auth`. Completar la verificación de portal, expedientes, cotizaciones y obras con identidades separadas.
3. Continuar las funcionalidades abiertas en la matriz, incluida la migración del catálogo y de las propuestas, y contrastar importes y PDFs antes de preparar la publicación.

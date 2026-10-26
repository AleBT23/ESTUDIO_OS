# 02 — Requisitos funcionales

Los IDs permiten rastrear implementación y pruebas.

## Inicio
- DASH-01 KPIs reales de proyectos, propuestas, cobros, pendientes y próximas entregas.
- DASH-02 Filtro por línea de negocio y periodo; totales consolidados sin doble conteo.
- DASH-03 Actividad reciente, búsqueda global, favoritos y acciones rápidas.

## Comercial
- CRM-01 Clientes personas/empresas, contactos, notas, archivos y origen de captación.
- CRM-02 Pipeline de prospectos: nuevo, contacto, propuesta, negociación, ganado, perdido; seguimiento y recordatorios.
- QUO-01 Catálogo editable: clave, categoría, nombre, unidad, precio, costo estimado, descripción, línea y vigencia.
- QUO-02 Presets de servicios con conceptos, cantidades, textos, documentos y condiciones; personalizables por cotización.
- QUO-03 Presupuestos con partidas, cantidades, precios, descuentos, IVA configurable, anticipo, vigencia, monedas y condiciones.
- QUO-04 Versiones, estados borrador/enviado/aceptado/rechazado/vencido, PDF inmutable al emitir.
- QUO-05 Convertir cotización aceptada en proyecto y paquetes de trabajo sin duplicar cliente ni conceptos.
- QUO-06 Calculadora de honorarios: por m², unidad, hora, visita, fijo o porcentaje; costos externos, horas previstas y margen; nunca sobreescribir precios de catálogo por editar cotización.
- MKT-01 Calendario de contenido, ideas, canales, estado, enlaces y resultados básicos; portafolio vinculado a proyectos y prospectos.

## Proyectos y producción
- PRJ-01 Proyecto con cliente, ubicación general, fechas, estado, responsables, documentos y enlaces externos.
- PRJ-02 Paquetes de servicios vinculados a línea de negocio; un proyecto admite varios paquetes de líneas diferentes.
- PRJ-03 Plantillas editables de fases por línea/servicio; arquitectura y visualización tienen etapas diferentes.
- TASK-01 Tareas/subtareas, responsables, prioridad, estado, fechas, dependencias simples, vistas lista/Kanban/calendario.
- DEL-01 Entregables, archivos/enlaces, revisiones, aprobaciones y fecha de entrega.
- CHG-01 Solicitudes de cambio, impacto en costo/plazo, aprobación, cotización complementaria y trazabilidad del alcance original.

## Administración
- FIN-01 Planes de cobro, anticipos, parcialidades, saldo; distinguir programado de efectivamente cobrado.
- FIN-02 Gastos, categorías, comprobantes, proveedor, paquete/proyecto y moneda.
- FIN-03 Honorarios y distribución entre colaboradores con reglas y registro de pagos; no confundir facturación con utilidad.
- TIME-01 Registro manual de tiempo por usuario, proyecto, paquete y tarea; edición y corrección auditables.
- PROF-01 Rentabilidad estimada/real por proyecto, paquete, línea y periodo; ingresos cobrados, costos directos, horas y tarifa efectiva; indicar fórmula.
- REP-01 Reportes filtrables y exportables CSV.

## Recursos
- DOC-01 Biblioteca de documentos estándar y plantillas con variables, versión y categorías.
- DOC-02 Membretes PNG, tamaño carta, márgenes y previsualización.
- DOC-03 Constructor PDF con secciones opcionales y reordenables: portada, agradecimiento, alcance, presupuesto, condiciones, aceptación.
- DOC-04 Documentos independientes (oficios, minutas, reportes de visita, cartas).
- LIB-01 Biblioteca técnica/BIM con etiquetas, vínculos, adjuntos, buscador y versiones básicas.
- SOP-01 Procedimientos y checklists reutilizables.

## Transversal
- CORE-01 Autenticación y roles; diseño preparado para colaboradores.
- CORE-02 Historial de eventos importantes y eliminaciones recuperables donde aplique.
- CORE-03 Importación/exportación y respaldos verificables.
- CORE-04 Notificaciones internas y recordatorios sin duplicar calendario.
- CORE-05 Formularios y vistas adaptables a escritorio y móvil.

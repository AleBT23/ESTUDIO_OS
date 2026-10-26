# 07 — PDF, membretes y plantillas

## Compatibilidad obligatoria
- Membrete PNG existente, colocado automáticamente en PDF **tamaño carta (215.9 × 279.4 mm)**.
- Preservar relación de aspecto, nunca deformar; mostrar advertencia si no coincide con la proporción carta y permitir modo ajuste con previsualización.
- Membretes múltiples, por organización o línea; archivos privados; prueba con PNG real.
- Márgenes independientes superior/inferior/izquierdo/derecho configurables por membrete, guía visual del área útil y presets.
- Como referencia de código actual: `pdf.js` usa márgenes izq 16 mm, der 32 mm, sup 22 mm; verificar reserva inferior en auditoría.

## Constructor
Secciones activables y reordenables: portada, carta de agradecimiento, explicación de lo contratado, presupuesto, condiciones, aceptación/firmas y anexos. Solo presupuesto obligatorio en cotizaciones. Documentos independientes pueden no tener presupuesto.

## Plantillas
Variables seguras con lista blanca: `cliente.nombre`, `proyecto.nombre`, `cotizacion.folio`, `cotizacion.total`, `cotizacion.anticipo`, `fecha`, `despacho.nombre`, etc. Validar variables ausentes antes de emitir. Editor de texto enriquecido acotado: títulos, párrafos, listas, tablas, imágenes, saltos y variables.

## Reglas de renderizado
- Paginación automática dentro del área útil; no solapar membrete, evitar cortes de filas, encabezados repetidos en tablas, control de viudas/huérfanas cuando sea posible.
- Acentos, ñ, símbolos monetarios y fuentes Unicode correctos; el código legado elimina acentos y esto debe corregirse.
- Totales y firmas sin recortes, numeración opcional, vista previa fiel, exportación descargable.
- Versionar PDF emitido y snapshot de datos. No cambiar documentos emitidos cuando cambie una plantilla.
- No prometer un porcentaje fijo de área útil: depende del diseño del membrete y sus márgenes.

## Pruebas mínimas
Cotización de una página; tabla larga de varias páginas; membrete con ornamento lateral; carta + alcance + presupuesto; desactivar todas las secciones opcionales; acentos; IVA y descuentos; páginas con firmas; descarga y reapertura del PDF.

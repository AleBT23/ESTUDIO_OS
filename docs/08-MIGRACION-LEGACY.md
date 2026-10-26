# 08 — Auditoría y migración del tabulador actual

## Evidencia verificada del RAR suministrado
Contiene `index.html`, `app.js`, `config.js`, `storage.js`, `pdf.js`, `styles.css`, `.gitattributes`.
- `index.html` identifica la app como **ArchiQuote Pro** y carga jsPDF 2.5.1 desde CDN.
- `storage.js` usa LocalStorage con claves para membrete Base64, servicios, biblioteca de conceptos, clientes, presupuestos y presets.
- `pdf.js` crea un documento jsPDF `format: 'letter'` y dibuja el PNG de membrete como fondo; márgenes fijos en código.
- `config.js` define servicios iniciales, moneda MXN, IVA configurable por app y unidades de servicio.
- `pdf.js` incluye conversión de caracteres acentuados a ASCII: deuda técnica.

## Advertencia crítica
El RAR contiene **código**, no necesariamente los datos actuales del LocalStorage del navegador del usuario. Nunca reemplazar ni limpiar LocalStorage sin una exportación verificable.

## Procedimiento
1. Extraer el RAR en directorio temporal y auditar archivos, funciones, estructuras, validaciones y reglas de cálculo.
2. Generar inventario con campos exactos de servicios, conceptos, presets, clientes, propuestas, ajustes y membrete.
3. Preparar un **exportador ejecutado en el navegador donde están los datos reales**: JSON versionado, fecha, conteos, checksum y adjuntos/imagen si procede.
4. Validar el JSON, normalizar referencias e importar primero a staging con reporte de errores y duplicados.
5. Comparar conteos, importes y muestras de PDFs entre sistemas; mantener copia del archivo original.
6. Activar nueva app cuando usuario apruebe migración y respaldos; disponer de plan de reversión.

## Pruebas de regresión
Comparar folios, impuestos, descuentos, unidades, subtotales, totales, presets, caracteres especiales y composición de páginas. No afirmar equivalencia hasta verificarla.

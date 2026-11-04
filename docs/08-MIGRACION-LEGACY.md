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

## Ensayo del directorio de clientes
En una base aislada con la migración 068, el administrador de PostgreSQL habilita únicamente la organización de ensayo en private.legacy_staging_targets. La tabla se crea vacía y carece de permisos de escritura para los usuarios de la aplicación. La interfaz de Configuración requiere APP_ENV=staging y una cuenta propietaria. Primero revisa la huella y el informe local. Después selecciona el tipo de clientes del lote y envía el archivo al entorno de pruebas. Los clientes ya coincidentes por ID se cuentan sin modificación. Ante diferencias o coincidencias ambiguas se revierte el lote completo. Los campos anteriores sin tipo de persona o empresa requieren clasificar el lote antes del ensayo.

## Ensayo de servicios y presets
Con las migraciones 075 y 076, revisa la exportación en Configuración y consulta los identificadores en el informe local. Importa cada servicio a la línea elegida. El catálogo exige moneda MXN explícita y precios representables en centavos. Conserva las tarifas porcentuales y el estado de archivo. Después selecciona el preset por su identificador. Todos sus servicios deben estar activos en el destino de ensayo. El preset conserva el orden del legado y cantidad uno en cada partida. Una repetición coincidente conserva la versión existente.

## Archivo histórico de propuestas
En staging, el propietario puede abrir el archivo desde Configuración y seleccionar una propuesta por el identificador mostrado en el informe de conciliación. Se conserva el contenido JSON de la propuesta, su folio y la huella de la exportación. La moneda mostrada corresponde a la configuración de la exportación. El vínculo al cliente se establece solo por identificador original. Los importes históricos quedan disponibles para cotejo y la operación carece de efectos financieros. Una revisión distinta del mismo identificador requiere conciliación antes de cualquier nueva incorporación.

## Conceptos reutilizables
La migración 078 habilita la importación individual a la biblioteca comercial del estudio de ensayo. Localiza el ID en el informe de revisión y selecciona ese registro en Configuración. El texto conserva acentos, espacios y saltos de línea. Si un miembro ya editó el concepto, la discrepancia requiere revisión.

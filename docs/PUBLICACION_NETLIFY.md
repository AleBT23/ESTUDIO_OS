# Configuración del sitio existente — ESTUDIO OS

26 de octubre de 2026. Sitio: https://splendorous-gumdrop-81a528.netlify.app

## Diagnóstico y corrección

El despliegue dd5a9a9 se publicó sin variables de entorno de Supabase. isConfigured() devolvía false tanto en servidor como en la aplicación y no mostraba el formulario de acceso. No fue un problema de datos, contraseña o RLS.

Se enlazó exclusivamente el sitio existente 4ee3b8b1-e79b-466a-85af-6decb0a28b93 al repositorio existente AleBT23/ESTUDIO_OS, rama main. Netlify CLI oficial 27.14.2 mediante npx; no instalación global ni cambios de PATH.

Se configuraron NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY desde .env.local, comprobando la referencia del Supabase ORIGINAL. APP_ENV=production. Contexto production y todos los ámbitos admitidos por Free (incluidos Builds y Functions); no se habilitaron datos de producción para previews/dev. Se verificó coincidencia sin imprimir valores. No se subieron DATABASE_URL, contraseñas, certificados, .env, service_role ni secretos de recuperación.

El primer intento de API con post-processing fue rechazado con 403; se utilizó post_processing, el valor real de la implementación oficial de CLI. Configuración final comprobada por lectura independiente.

Netlify también marcaba el sitio como Private: una solicitud sin sesión Netlify recibía 401 antes de llegar a Next. El propietario autorizó expresamente Make public y se ejecutó; Netlify confirmó «Your project is public». La URL ya responde sin sesión Netlify. Supabase Auth y RLS permanecen activos y no se cambió el plan.

## Verificación antes del nuevo despliegue

- 109 pruebas correctas en 15 archivos, en entornos aislados.
- TypeScript sin caché incremental y lint correctos. ESLint excluye .local y .netlify, artefactos privados/generados ajenos al código publicable.
- Build Next.js 16.4.2 correcto; Node 24, rutas dinámicas y proxy compilados. Conservados netlify.toml, adaptador oficial automático y paquetes Node de PDF/Sharp.
- Supabase Auth /settings devuelve 200 con email habilitado. REST rechaza acceso sin sesión.
- Preflight SQL estrictamente READ ONLY: diez migraciones, 011 ausente, buckets privados y huellas de siete tablas de negocio guardadas localmente para comparación final.

## Publicación real y pruebas

Commit e9534aae88b01005bcfa6686c3def75b36b79756 enviado a GitHub/main. Deploy 6adf9188c1c5c3c5e2b153e3 confirmado ready y published por la API y la interfaz de Netlify; adaptador Next.js Runtime automático, una Function y una Edge Function. Metadatos de la Function confirman nodejs24.x. El registro de publicación registra ocho entradas sin error y Site is live; las etapas de build aparecen Skipped en el detalle y no se obtuvo un registro remoto completo del compilador. La compilación local de producción sí pasó.

- Once comprobaciones HTTP reales sin cookies: /acceso muestra formulario y /configuracion ya no indica Conexión pendiente. Los destinos con requireContext redirigen a /acceso, incluso mediante streaming de Next con HTTP 200. PDF/metadatos rechazan con 403 y fotos con 401, todas las respuestas comprobadas private, no-store.
- Las páginas generales /, /comercial, /proyectos y /administracion conservan sus carcasas públicas vacías previstas en el código. Ninguna contiene IDs de los registros existentes comprobados por lectura administrativa; no se abrió acceso a las filas. El primer arnés esperaba 307 para esas carcasas y se corrigió contra la implementación real, sin cambiar rutas ni seguridad.
- 52 JavaScript públicos inspeccionados: URL/clave publicable originales incorporadas correctamente, sin referencia al Supabase de recuperación ni credenciales privilegiadas conocidas. No se imprimieron sus valores. NEXT_PUBLIC es configuración pública de navegador por diseño; la autorización sigue dependiendo de identidad y RLS.
- 38 entradas de ejecución de la Function consultadas en la ventana comprobada, cero entradas error/fatal. Esto no garantiza ausencia de fallos futuros.
- Conteos y hashes de projects, project_observations, project_photos, clients, quotes, quote_versions y payments idénticos al preflight (11:52 de Ciudad de México). No se guardaron, emitieron ni eliminaron registros para probar.

## Autenticación real y pendientes

El propietario confirmó el inicio de sesión y se verificó en el navegador real. La sesión persistió tras recargar y navegar; Configuración muestra los tres pasos Listo y rol owner. Se cargaron los dos proyectos y clientes existentes, un expediente con notas y cobros, y la cotización guardada. No se crearon registros ni se pulsaron acciones de edición, emisión o cobro. No se extrajeron cookies ni se solicitó/registró la contraseña. No se probó logout ni una expiración forzada del JWT.

La vista previa PDF autenticada devolvió el error genérico de generación. La misma cotización, leída mediante transacción READ ONLY, pasó el esquema y produjo PDF en el renderizador local. Se añadió diagnóstico seguro de etapa/código/recurso y frames de archivos sin mensaje bruto, datos de cliente, tokens ni rutas privadas; pruebas de privacidad y regresiones PDF correctas. El registro seguro confirmó MODULE_NOT_FOUND durante render.

### Corrección del empaquetado PDF

PDFKit 0.20.1 usa createRequire(import.meta.url) y #standard-fonts/Helvetica para cargar js/standard-fonts/Helvetica.cjs. El trace real de Next incluía solo las variantes .mjs; el paquete aislado con esos mismos archivos reprodujo MODULE_NOT_FOUND. Al añadir las 15 piezas CJS (14 fuentes y un chunk compartido) se generó el PDF sintético correctamente.

Se añadió el glob node_modules/pdfkit/js/standard-fonts/**/*.cjs al tracing de Next y a included_files de Functions. Se conservan Poppins, Noto, membrete, cálculos, importes y archivos anteriores. El postbuild scripts/check-pdf-packaging.mjs verifica ambas rutas, resuelve las 14 fuentes por el contrato público de PDFKit y genera un PDF con solo el PDFKit trazado en un directorio temporal aislado. No carga .env ni utiliza Supabase.

Lint y TypeScript correctos; 117 pruebas correctas, incluyendo ocho de diagnóstico sin mensajes/credenciales/rutas privadas. Guard postbuild correcto. Corrección publicada como 9dec635a9357275e24d9fcbc9d201824d5657244, deploy 6adfa78c9df8a44f788f5d71, confirmado ready/published.

La vista previa autenticada de una cotización existente se descargó del sitio real y se reabrió con PDF-lib/PDF.js: 505,480 bytes, siete páginas de 612 × 792 puntos (carta), marca BORRADOR, Poppins Regular/Medium/SemiBold incrustadas e imagen del membrete en las siete páginas. No se emitió, subió ni guardó una versión en Supabase. El visor/descargador de navegador tardó más de lo previsto; la comprobación válida es la del archivo descargado y sus bytes, no una pantalla en blanco del plugin PDF.

El mismo endpoint real consultado sin cookies devuelve 403 y private, no-store después de la generación autenticada. Configuración sigue mostrando tres pasos Listo y owner tras navegación y publicaciones. Se conservaron 26/26 conteos y hashes de tablas públicas respecto al baseline de la inspección autenticada. Diez migraciones, 011 ausente, 54 políticas y buckets privados. Evidencias en .local/netlify-real-pdf-verification.json y .local/netlify-auth-final-integrity.json; archivos privados excluidos de Git.

La migración 011 sigue SIN aplicar; las nuevas fotografías necesitan autorización SQL independiente. No intentar reparar esa ausencia con claves privilegiadas, políticas abiertas o ejecución automática de migraciones. No se crearán observaciones/cobros/cotizaciones para probar sobre los datos existentes.

La configuración Auth Site URL no es necesaria para el flujo actual correo/contraseña sin redirección externa; revisar su valor si posteriormente se implementan enlaces de correo/OAuth. No se modificó Auth de forma preventiva.


El cierre documental se envía con [skip netlify] para evitar otro despliegue por cambios solo de documentación; la primera reparación de conexión se publicó como e9534aa, el diagnóstico PDF como 48f9392 y la reparación verificada de PDF como 9dec635. No se deshabilitaron builds ni auto-publicación. Evidencias privadas (sin valores de claves) en .local/netlify-*.json y capturas de acceso en la carpeta de visualizaciones de esta conversación.


Limitaciones: 011 necesita autorización específica para habilitar nuevas fotografías; no se probó su flujo real ni se ejecutó SQL. No se creó un documento independiente ficticio en producción; su renderer conserva las pruebas locales y el chequeo de trazado de ambas rutas. No se forzó expiración JWT/logout ni se ensayaron iPhone/iPad físicos. No se cambió de plan ni se utilizó el proyecto de recuperación; tampoco se modificaron datos/cálculos existentes. El servidor temporal 127.0.0.1:3107 fue detenido; el servidor habitual no se alteró.

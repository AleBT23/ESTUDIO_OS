# Desarrollo y configuración

Node 22+ (verificado 24.19), npm y Supabase para autenticación/persistencia. Pruebas SQL usan PGlite (PostgreSQL embebido real) con identidad de pruebas explícita; no reemplaza Supabase Auth productivo.

## Arranque

1. npm ci.
2. Copiar .env.example a .env.local; configurar URL, clave publicable y DATABASE\_URL de desarrollo/staging. Nunca service\_role en navegador ni compartir contraseñas por chat.
3. Guardar CA oficial en .local/supabase-ca.crt; npm run db:migrate usa TLS con verificación obligatoria. Transacciones, registro de checksum e inmutabilidad de migraciones aplicadas. Requiere Supabase (auth.users, auth.uid(), authenticated/anon y Storage). Diez migraciones aplicadas: siete funcionales iniciales, permisos RPC, archivo de cotizaciones y expediente/bitácora. Buckets privados estudio-documents y project-photos. No sobrescribir buckets existentes ni modificar migraciones registradas.
4. Crear primer usuario correo/contraseña en el panel Supabase Auth. Sin registro público en esta app. Revisar proveedor y límites de acceso antes de exponer.
5. npm run dev; abrir http://127.0.0.1:3000; iniciar sesión y crear estudio. Crea dos clasificaciones de negocio; ningún cliente ni movimiento ficticio.

Sin credenciales se muestra instalación pendiente; se bloquea captura en vez de fingir persistencia. Configuración y usuario remotos requieren al propietario.

## Comandos
- Teléfono en la misma Wi-Fi: dev:lan o start:lan permiten escuchar en red local **solo tras autorización del propietario**. Abrir la IP privada del PC, puerto 3000; localhost del teléfono apunta al teléfono. Sin cambios automáticos de cortafuegos/router. No es publicación en Internet.
- Pendientes/bitácora/proyectos manuales activados con la migración 010 autorizada y aplicada el 26 de octubre de 2026. Diez migraciones aplicadas; fotografías privadas en project-photos.

* npm run lint; npm run typecheck; npm test; npm run build.
* npm run db:verify: migraciones, RLS, permisos y referencias en PostgreSQL embebido.
* npx playwright install chromium; npm run test:e2e: navegación, móvil, marca y guardas sin conexión. No prueba aún login remoto.
* npm run start: compilación productiva local.
* npm run audit:legacy: inventario de extracción (ver AUDITORIA-LEGACY.md).
* npm run seed:demo: solo APP\_ENV=development y DEMO\_ORGANIZATION\_ID explícito; nunca automático.

Webpack explícito porque Turbopack falló creando subproceso PostCSS bajo sandbox Windows. Build Webpack verificado fuera de esa restricción. Permiso de compilación del entorno no cambia controles de acceso de app.

## Seguridad y pendientes

organization\_id en consultas y RLS independiente; FK compuestas; privilegios por columnas evitan mover filas y falsificar versiones. Owner/admin editan; collaborator/reader consultan clientes. Invitaciones/roles y permisos por proyecto pendientes.

getUser en servidor y proxy de renovación; cada acción revalida sesión y rol. Sin clave de servicio. Server Actions usan comprobación de origen Next.js. Revisar allowedOrigins si se cambia arquitectura de proxy.

Archivo recuperable con auditoría; sin borrado físico. Conflictos por versión. Backups BD/archivos y restauración ensayada pendientes; exportación legado no los reemplaza.

Antes de producción: respaldo/restore, revisión de migraciones, MFA/rate limiting proveedor, E2E con usuario real y roles, storage privado, correo, monitoreo, dominio y aprobación. No desplegado.

## Flujo ya preparado para probar con datos propios

Clientes y contactos → catálogo → presets → borrador de cotización → vista previa PDF → emitir versión privada → descargar y compartir por el medio elegido → registrar envío manual → aceptar con fechas de pago → expediente/paquetes y obligaciones → registrar pago efectivo → reversar si procede. Compartir/envío no manda emails automáticamente.

Vista previa/descarga están autorizadas en servidor, sin caché pública. La descarga verifica SHA-256 del archivo guardado; no regenera un PDF emitido. Cada edición conserva sus snapshots previos. Fuente Noto Sans WOFF libre en assets/fonts con licencia; posprocesado pdf-lib para numeración estable. El renderer se ejecuta en Node, no en Edge.

Las fixtures PDF de tests/artifacts son sintéticas. npm test genera/reabre una carta de 1 página y una propuesta de 12 páginas (45 partidas y seis secciones), verifica Unicode, coordenadas, fondos, encabezados y totales. Inspección visual con Poppler realizada; no implica equivalencia visual con jsPDF legado ni validación de propuestas reales.

## Inicio cotidiano sin terminal

Haz doble clic en **ESTUDIO OS** en el escritorio. También puedes abrir `Abrir ESTUDIO OS.vbs` en la carpeta del proyecto. El lanzador inicia el servidor en segundo plano si hace falta y abre http://localhost:3000; repetirlo reutiliza el servidor existente. Los errores de inicio se notifican en una ventana y los registros quedan en `.local/launcher-*.log`.

El teléfono usa la dirección Wi-Fi del PC, con ambos en la misma red. El PC debe permanecer encendido; cerrar el navegador no detiene el servidor. Este acceso directo no inicia la aplicación automáticamente al encender Windows.

## Límites visibles del incremento

Ver TRAZABILIDAD.md para cada ID. Límites de listados se indican en pantalla; no hay analítica calculada sobre datos truncados. Catálogo/presets/pipeline consultan hasta 500 registros; selectores de propuestas hasta 500 clientes/servicios; pendientes de sustituir por búsqueda paginada para volúmenes mayores. Administración pagina obligaciones/movimientos, y el selector usa las obligaciones visibles de esa página.

No hay claim de plataforma completa: faltan módulos de producción, gastos/tiempo/repartos, plantillas documentales y edición enriquecida, biblioteca/procedimientos/marketing y analítica, además de hardening y validación remota.

## Continuación sin Supabase

El proyecto remoto ya está conectado y migrado con TLS verificado. No se crean datos ficticios en la app para reemplazar persistencia. Falta crear el primer usuario real en Supabase Auth, iniciar sesión y ensayar emisión/descarga con su cuenta.

Biblioteca comercial de conceptos disponible en Comercial → Conceptos: alta, búsqueda/paginación, edición, archivo/restauración y copia de texto al editor de partidas. El editor de honorarios muestra resultado antes de costo de horas, margen e ingreso por hora con fórmulas sin IVA.

Las propuestas pueden rechazarse, registrar vencimiento real o volver a borrador como revisión de una enviada/rechazada/vencida; motivo obligatorio, versión optimista y snapshots conservados. Una aceptada no se reabre: los extras se implementarán por separado.

Recursos → Documentos permite guardar cartas, oficios, minutas y reportes sin presupuesto. Cliente/proyecto opcionales; el proyecto hereda su cliente y rechaza incompatibilidades. Guardar → previsualizar PDF → emitir → descargar versión guardada. El editor admite párrafos, subtítulos, listas y saltos mediante botones; tablas/imágenes y biblioteca de plantillas aún pendientes. No se ejecuta HTML.

Variables de fecha/estudio/cliente/proyecto resueltas desde snapshot; lista blanca, sintaxis incompleta y datos faltantes detienen emisión. Variables de cotización están previstas en el motor, pero requieren contexto de plantilla aún no integrado en este editor. Las entradas no se evalúan recursivamente.

Los selectores de documentos consultan hasta 500 clientes/proyectos. No representan buscadores paginados terminados para grandes volúmenes. Los archivos preparados pero no emitidos siguen el mismo mecanismo de compensación/mantenimiento pendiente que las cotizaciones.

Referencias: [Next.js oficial](https://nextjs.org/docs/app/getting-started/installation), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) y guías locales de versión instalada en node\_modules/next/dist/docs. Versiones fijadas en package-lock.json.


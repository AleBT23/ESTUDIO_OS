# Primera publicación en Netlify Free

Fecha: 26 de octubre de 2026. Actualización: sitio existente publicado y conexión configurada; ver [PUBLICACION_NETLIFY.md](PUBLICACION_NETLIFY.md) para resultados y pendientes actuales. El resto conserva la guía y evidencia de preparación inicial. No se aplicó 011.

## Configuración elegida

- Next.js 16.4.2 conserva App Router, Server Actions y proxy de Supabase. Node 24 en `.nvmrc` y `netlify.toml`; no se cambia el Node global ni los comandos locales.
- Build: `npm run build` (Webpack), salida `.next`, adaptador oficial automático Next.js/OpenNext de Netlify. No instalar/fijar el plugin legacy ni exportar estáticamente.
- Fuentes Poppins/Noto y PNG del membrete incluidos explícitamente. `sharp` y React PDF externos al empaquetador; construir dependencias Linux en Netlify, nunca subir node_modules de Windows. Se conservan los dos renderizadores y sus rutas Node.
- No hay migraciones ni seed en install/build. El lanzador local y dev/dev:lan/start/start:lan se conservan.
- El proyecto todavía no tiene commits ni remoto configurado: preparar un repositorio PRIVADO y revisar sus candidatos antes de subirlo. No se creó remoto, commit ni push durante esta tarea.

## Fotografías: flujo y controles

1. El formulario convierte formatos que el navegador pueda abrir a JPEG de máximo 1600 px, 2 MiB por copia y cinco fotos. Safari/HEIC físico sigue pendiente; si el navegador no decodifica, pide exportar JPEG sin perder originales.
2. Solo texto/metadatos pequeños llegan a la Server Action. RPC `prepare_project_observation` valida rol, organización, proyecto activo, fecha, cinco tamaños y genera rutas. Preparación atómica e idempotente con UUID de solicitud generado en servidor (también funciona en LAN HTTP sin crypto.randomUUID del navegador).
3. El navegador usa `createBrowserClient`, la clave PUBLICABLE y la sesión del usuario para subir cada foto directamente al bucket privado `project-photo-uploads`. Sin URLs públicas, service_role ni upsert. RLS exige autor, rol permitido, proyecto activo y una ruta registrada.
4. Confirmación Node descarga los temporales de uno en uno, comprueba bytes reales con sharp (no confía en MIME), limita píxeles/tamaño, normaliza JPEG y elimina EXIF. Sube copias canónicas al bucket definitivo existente `project-photos`, registra su tamaño real y publica mediante el RPC existente.
5. Temporales nunca se muestran como imágenes publicadas. Una copia pendiente definitiva solo es legible por su autor con permisos; publicados conservan lectura de miembros e inmutabilidad.
6. Reintentos verifican publicación previa y comparan bytes de colisiones sin sobrescribir. El mismo intento se conserva en memoria frente a respuestas perdidas; texto/fotos quedan bloqueados hasta confirmar o descartar. No volver a crear la observación por un error de confirmación.
7. Descartar elimina solamente los archivos preparados del autor y luego el borrador. No elimina publicados. Una copia temporal cuya limpieza falle no convierte una publicación confirmada en fracaso.

El tráfico binario navegador→Storage evita el límite de aproximadamente 4,5 MB de carga binaria de Functions. La validación sigue consumiendo tiempo/cómputo y transferencia servidor↔Supabase: medir cinco fotos y PDF largos en una URL de revisión. No se implementó modo offline ni carga en segundo plano.

## Migración 011: pendiente, NO aplicada

`supabase/migrations/202610260011_direct_project_photos.sql` es aditiva:

- crea bucket temporal privado JPEG/2 MiB y políticas restrictivas incluso ante políticas permisivas ajenas;
- permite al autor leer su copia definitiva aún no publicada para reintentos/limpieza;
- permite actualizar únicamente byte_size en fotos preparadas del autor;
- añade RPC atómico de preparación. No cambia observaciones/fotos existentes ni las diez migraciones anteriores.

**Antes de usar el nuevo formulario tanto localmente como en Netlify se necesita revisar y autorizar/aplicar 011**. Sin ella la preparación muestra un error explícito y no simula guardado. No aplicar SQL al arrancar/build ni cambiar APP_ENV para eludir el bloqueo del migrador de producción. La autorización del propietario y un respaldo/ensayo previo siguen pendientes.

El cierre/recarga durante una carga puede dejar borradores/temporales privados. La recuperación automática solo se garantiza en la pantalla abierta; no se añade almacenamiento persistente del navegador. Mantenimiento posterior: revisar borradores del autor antes de descartarlos, y limpiar temporales de observaciones YA publicadas. No borrar objetos o borradores masivamente por antigüedad sin revisión. No se configuró cron ni retención automática.

## Variables y Auth

En Netlify (Production; previews solo con proyecto de prueba autorizado):

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto elegido. Build y Functions.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave publicable del mismo proyecto. Build y Functions.
- `APP_ENV=production` y `NODE_VERSION=24` ya están en netlify.toml. APP_ENV no sustituye permisos ni RLS.
- NO configurar DATABASE_URL, certificados CA, service_role, contraseñas del usuario ni tokens de Netlify en NEXT_PUBLIC_*.
- No fijar NODE_ENV=production durante instalación: se necesitan dependencias de compilación.

En Supabase Auth, cuando exista el dominio definitivo autorizado:

- Site URL: origen HTTPS de producción.
- Conservar localhost/IP usados en desarrollo como redirecciones adicionales si se necesitan; permitir solo destinos de revisión realmente autorizados. Evitar comodines amplios de producción.
- El acceso actual usa correo/contraseña; no inventar un callback OAuth ni recuperación de contraseña no implementados.
- Mantener buckets privados, RLS y límites. No habilitar acceso público ni incluir claves privilegiadas para “hacer funcionar” una carga.
  No se cambiaron ajustes remotos.

## Comprobación y publicación por el propietario

1. Revisar `npm run check:publish`, candidatos de Git y contenido de public antes de subir a un repositorio privado. El escáner es heurístico y no sustituye la revisión de datos personales; no imprime credenciales.
2. Autorizar revisión/ensayo/aplicación de 011 con respaldo y verificar Storage real autenticado. Supabase de pruebas para pruebas que creen fotos/observaciones.
3. Importar en Netlify con detección Next.js, Node 24, npm run build y .next; establecer las dos variables públicas. Crear primero URL de revisión, no promover automáticamente.
4. Verificar login/logout/renovación, protección entre usuarios/organizaciones, CSRF/origen Server Actions, revalidación y respuestas privadas no cacheadas. Probar cotizaciones existentes, ambos PDF con fuentes/membrete, descarga inmutable con SHA-256 y cinco fotos (incluidas >4,5 MB agregadas).
5. En DevTools comprobar que cada carga grande va al dominio Supabase, y que prepare/finish/cancel hacia Next solo llevan metadatos. Interrumpir red y reintentar: un registro, sin archivos públicos ni sobrescrituras.
6. Autorizar promoción y cambios de Supabase Auth; comprobar Safari iPhone/iPad y Windows desde otra red y con PC apagado.

Netlify Free tiene 300 créditos mensuales compartidos; producción cuesta 15 créditos por deploy, más cómputo/tráfico/solicitudes. Su agotamiento pausa los proyectos del equipo. Supabase Free puede pausarse por baja actividad de siete días. No se garantiza disponibilidad profesional continua con ambos planes gratuitos.

## Evidencia local

- Node local 24.19.0; lint, typecheck sin caché incremental y build Webpack correctos.
- **99 pruebas correctas en 14 archivos**: cálculos, regresiones PDF (cotizaciones y documentos), permisos/RLS, preparación transaccional/idempotente, validación real sharp y recuperación de cargas.
- El SDK real de Supabase envía cinco archivos sintéticos de 2 MiB a su endpoint Storage con token de usuario; se intercepta el HTTP solo en el test, sin conectarse al proveedor.
- **22 comprobaciones de arranque** en Chromium/WebKit sobre la compilación local nueva: login, rutas privadas, redirecciones reales (incluido streaming), ausencia de errores JS y desbordamiento a 390/1440 px.
- `node scripts/check-netlify-smoke.mjs` reproduce estas comprobaciones con un servidor de pruebas previamente iniciado en 127.0.0.1:3107 (`node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3107`). No reutiliza el servidor anterior del puerto 3000.
- Las tres Server Actions de fotos aparecen en el manifiesto compilado; las dos rutas PDF incluyen fuentes/membrete y sus archivos de trazas existen. Las comprobaciones posteriores solo imprimen resultados booleanos. Se regeneró la compilación para renovar una clave interna de Next mostrada en una inspección previa; no se modificaron credenciales de Supabase.
- `npm run check:publish` correcto: candidatos Git sin credenciales privilegiadas conocidas, certificados, respaldos ni legado. No hay commit/remoto y no se hizo push.
- Reiniciar la instancia Next local después de activar 011 para cargar el nuevo build. No se detuvo ni reconfiguró el servidor anterior del usuario. Las pruebas SQL usan PostgreSQL PGlite aislado; Storage HTTP se intercepta o sustituye en pruebas. No equivalen a subida Auth real, despliegue Linux/Netlify ni Safari físico.

## Referencias verificadas

- https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- https://docs.netlify.com/build/functions/configuration/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
- https://supabase.com/docs/reference/javascript/storage-from-upload
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://sharp.pixelplumbing.com/install/

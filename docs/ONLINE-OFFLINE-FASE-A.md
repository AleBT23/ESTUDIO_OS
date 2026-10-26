# Online + Offline — Fase A: auditoría y preparación

Fecha: 26 de octubre de 2026. Estado: preparación local; publicación pendiente de cuenta/hosting. No se implementaron ni se declaran terminadas las fases B–E.

## Resultado comprobado

- ESTUDIO OS está en C:/Users/aleja/Desktop/ESTUDIO_OS. El chat desde el que se realizó la inspección está ubicado en AB_BIM_TOOLS; no se mezclan sus fuentes.
- Next.js App Router, TypeScript, Supabase SSR, PostgreSQL y Storage. El layout es force-dynamic y verifica contexto de usuario en servidor; las capturas/escrituras actuales dependen de Server Actions.
- El lanzador inicia Next en el PC y habilita LAN. La documentación registra acceso local por IP privada: exige PC y proceso encendidos, y no equivale a un despliegue en Internet.
- No existe .vercel local. No se encontró CLI vercel ni VERCEL_TOKEN/VERCEL_PROJECT_ID en el entorno de esta sesión. No se localizó una URL pública en la configuración inspeccionada. Esto no demuestra que no exista una publicación en otra cuenta.
- .env.local contiene los cuatro nombres esperados y sus valores están presentes; no se imprimieron valores ni se modificó el archivo.
- La consulta HTTP a 127.0.0.1:3000/acceso no pudo completarse desde este contexto. No se inició/detuvo el servidor ni se diagnosticó ese resultado como caída confirmada de la app.
- Git no permitió consultar el árbol de trabajo desde el contexto de este chat. No se cambió su configuración ni se declara estado del índice/remoto verificado.

## Compatibilidad de despliegue

Se propone Vercel por el adaptador Next.js y el uso existente de Server Actions/SSR. Se requiere confirmar cuenta/proyecto y acceso antes de publicar. No usar exportación estática: rompería flujos actuales de servidor.

Las rutas PDF usan runtime nodejs y React PDF. Cargan Poppins y el membrete mediante fs/process.cwd; los archivos están presentes y next.config.ts ya incluye assets/fonts y el membrete en outputFileTracingIncludes. Esa configuración necesita validación en el paquete desplegado, no solo existencia local. No cambiar a Edge.

El runtime usa el cliente Supabase SSR y la clave publicable, con la sesión del usuario. DATABASE_URL y el certificado CA son para el migrador local; no se necesitan en el navegador ni deben copiarse por defecto al hosting. No ejecutar migraciones durante el build.

La preparación añade .vercelignore para excluir .env privados, certificados/logs locales, legado y artefactos. Conserva fuentes, public, assets/fonts, branding, package.json y package-lock.json. No instala software ni cambia dependencias.

## Procedimiento de publicación pendiente

1. Confirmar cuenta/proyecto Vercel y acceso. Si se usa otro hosting, validar SSR, Server Actions, runtime Node y empaquetado de fuentes/PNG antes de cambiar configuración.
2. Importar el repositorio existente o enlazar ESTA carpeta con el proyecto autorizado. No publicar el RAR/legado, .env.local, certificados ni registros. No inicializar otro repositorio para eludir el estado actual de Git.
3. Elegir framework Next.js y build npm run build. La versión de Node se debe contrastar con la instalación probada y las versiones admitidas por el proveedor; no cambiar globalmente Node.
4. Configurar en el proveedor NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY del proyecto correcto, y APP_ENV=production. No copiar secretos al cliente ni añadir service_role. No sobrescribir el .env.local de desarrollo.
5. Compilar y comprobar primero una URL de revisión con el acceso acordado. Verificar /acceso, rutas protegidas sin sesión, cuenta/rol autorizado y PDF con Poppins/membrete. Los datos del estudio permanecen en Supabase.
6. Con el dominio definitivo, ajustar Supabase Auth Site URL a HTTPS de producción y permitir las URLs exactas necesarias. Conservar los orígenes locales usados en desarrollo. La app actual usa correo/contraseña y redirecciones relativas; no incluye todavía callback OAuth ni recuperación de contraseña: no inventar rutas para esos flujos.
7. Promover a producción y verificar la URL real. La comprobación desde teléfono con el PC apagado debe hacerla el propietario; no se afirma prueba física por usar un navegador de escritorio.

Fuentes oficiales revisadas:
- https://vercel.com/docs/projects/deploy-from-cli
- https://vercel.com/docs/environment-variables
- https://supabase.com/docs/guides/auth/redirect-urls
- https://nextjs.org/docs/app/guides/progressive-web-apps

## Decisiones para las fases B–E

La solicitud actual autoriza diseñar soporte híbrido y sustituye el supuesto histórico de solo online. No se crean apps paralelas ni se reescriben módulos.

- B: manifest/iconos/SW y shell público offline. Nunca cachear HTML autenticado, respuestas RSC personalizadas, APIs ni Supabase indiscriminadamente. IndexedDB por usuario y organización para datos previamente autorizados; visibilidad bloqueada al cerrar sesión, sin descartar pendientes silenciosamente.
- C: cola persistente, IDs estables, recibos/idempotencia, versión base y conflictos. Reutilizar tablas/RPC/versiones existentes. Descargar cambios con cursor estable y tombstones o reconciliación verificable; no interpretar pérdida de permisos como eliminación global. Ejecutar al abrir, reconectar, volver a primer plano y manualmente.
- D: borradores de cotización y movimientos económicos separados de confirmación remota. Los pagos existentes ya tienen controles de idempotencia y reversos: revisar y reutilizar su contrato, con comprobación RLS/proyecto/importe en servidor. No asignar folios definitivos offline ni actualizar saldos confirmados localmente.
- E: el renderer actual depende de Node/fs. Evaluar una entrada de navegador que reutilice snapshots, cálculo y Poppins; si requiere refactorización amplia, limitar a prueba aislada sin sustituir PDF online. Borrador pendiente visible cuando haya cambios sin sincronizar.

Las migraciones que resulten necesarias requerirán revisión y autorización separada antes de aplicarse remotamente. No se preparó ni ejecutó SQL nuevo durante esta auditoría. Supabase continúa como fuente de verdad de registros confirmados.

## Validación de esta preparación

Inspección de README, AGENTS y todos los documentos de docs; revisión de scripts de arranque, configuración Next, proxy, autenticación, adaptador Supabase y rutas/renderizador PDF. Se comprobó presencia de fuentes/PNG y variables, sin revelar secretos. Solo se añadieron documentos/exclusiones de empaquetado; no se cambiaron módulos, datos, permisos, modelos ni el entorno local de la app.

Pendientes antes de dar A por completada: cuenta/acceso al hosting, build del despliegue, configuración real de URLs Auth y URL pública funcional. Lint, typecheck, build y flujo Auth/PDF deben repetirse sobre el incremento ejecutable antes de publicar. No se inició B mientras A sigue pendiente de infraestructura.

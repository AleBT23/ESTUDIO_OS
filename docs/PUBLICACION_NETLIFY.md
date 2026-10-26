# Configuración del sitio existente — ESTUDIO OS

26 de octubre de 2026. Sitio: https://splendorous-gumdrop-81a528.netlify.app

## Diagnóstico y corrección

El despliegue dd5a9a9 se publicó sin variables de entorno de Supabase. isConfigured() devolvía false tanto en servidor como en la aplicación y no mostraba el formulario de acceso. No fue un problema de datos, contraseña o RLS.

Se enlazó exclusivamente el sitio existente 4ee3b8b1-e79b-466a-85af-6decb0a28b93 al repositorio existente AleBT23/ESTUDIO_OS, rama main. Netlify CLI oficial 27.14.2 mediante npx; no instalación global ni cambios de PATH.

Se configuraron NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY desde .env.local, comprobando la referencia del Supabase ORIGINAL. APP_ENV=production. Contexto production y todos los ámbitos admitidos por Free (incluidos Builds y Functions); no se habilitaron datos de producción para previews/dev. Se verificó coincidencia sin imprimir valores. No se subieron DATABASE_URL, contraseñas, certificados, .env, service_role ni secretos de recuperación.

El primer intento de API con post-processing fue rechazado con 403; se utilizó post_processing, el valor real de la implementación oficial de CLI. Configuración final comprobada por lectura independiente.

Netlify también marcaba el sitio como Private: una solicitud sin sesión Netlify recibía 401 antes de llegar a Next. El paso Make public está pendiente de autorización específica porque cambia el alcance de acceso a la URL; Supabase Auth y RLS permanecen activos. No se cambió el plan.

## Verificación antes del nuevo despliegue

- 109 pruebas correctas en 15 archivos, en entornos aislados.
- TypeScript sin caché incremental y lint correctos. ESLint excluye .local y .netlify, artefactos privados/generados ajenos al código publicable.
- Build Next.js 16.4.2 correcto; Node 24, rutas dinámicas y proxy compilados. Conservados netlify.toml, adaptador oficial automático y paquetes Node de PDF/Sharp.
- Supabase Auth /settings devuelve 200 con email habilitado. REST rechaza acceso sin sesión.
- Preflight SQL estrictamente READ ONLY: diez migraciones, 011 ausente, buckets privados y huellas de siete tablas de negocio guardadas localmente para comparación final.

## Pendientes de comprobación real

Publicar el nuevo build con las variables, resolver la restricción Private si se autoriza y comprobar login real, cookies/sesión y lecturas de proyectos/cotizaciones del propietario. No se dispone de la contraseña del usuario y no se debe pedir en el chat ni generar una sesión administrativa para sustituir su login.

La migración 011 sigue SIN aplicar; las nuevas fotografías necesitan autorización SQL independiente. No intentar reparar esa ausencia con claves privilegiadas, políticas abiertas o ejecución automática de migraciones. No se crearán observaciones/cobros/cotizaciones para probar sobre los datos existentes.

La configuración Auth Site URL no es necesaria para el flujo actual correo/contraseña sin redirección externa; revisar su valor si posteriormente se implementan enlaces de correo/OAuth. No se modificó Auth de forma preventiva.

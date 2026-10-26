# 05 — Arquitectura técnica

## Stack objetivo

- Next.js (App Router) + React + TypeScript.
- Tailwind CSS + shadcn/ui; formularios validados con Zod.
- PostgreSQL en Supabase; autenticación y almacenamiento de archivos mediante Supabase.
- Despliegue elegido: Netlify Free (26 de octubre de 2026), Node 24 y adaptador automático oficial Next.js/OpenNext. Configuración y publicación remotas pendientes de autorización; ver NETLIFY-PRIMERA-PUBLICACION.md.
- Motor de documentos desacoplado mediante interfaz `DocumentRenderer` y pruebas visuales/regresión. Evaluar jsPDF existente vs renderizado HTML/PDF según fidelidad y paginación.

## Estructura recomendada

`src/app` rutas y layouts; `src/modules/{crm,quotes,documents,projects,tasks,finance,resources,marketing,dashboard}`; `src/shared` UI, auth, db, permissions, money, files, events; `supabase/migrations`; `tests`.

## Decisiones

- Monolito modular; servicios y repositorios internos con límites claros.
- Operaciones de escritura validadas en servidor, autorización en servidor y políticas RLS.
- Operaciones compuestas transaccionales (aceptar cotización, crear proyecto, planes de pago).
- Cálculos monetarios centralizados y deterministas; zona horaria configurable, predeterminado America/Mexico_City.
- Archivos privados por defecto, URLs firmadas con expiración y control de acceso.
- Sincronización offline no prometida: requiere decisión posterior.
- Jobs/notificaciones con proveedor elegible más adelante; la lógica debe poder probarse sin ese proveedor.
- No almacenar imágenes Base64 voluminosas en tablas si se dispone de storage; guardar metadatos y referencia al objeto.

## Configuración

Crear `.env.example`, scripts de desarrollo, migración, seed demo, lint, typecheck, test y build. Separar ambientes dev/staging/prod. No incluir credenciales en documentación ni commits.

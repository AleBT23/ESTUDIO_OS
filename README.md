# ESTUDIO OS — documentación maestra

Plataforma interna para administrar un estudio con **dos líneas de negocio**: Arquitectura y Visualización Arquitectónica. **Un único dashboard** y cuatro áreas: Comercial, Proyectos y Producción, Administración, Recursos del estudio.

## Objetivo

Construir todos los módulos acordados en una única aplicación coherente, implementada en incrementos verificables, sin pantallas simuladas como resultado final. La fuente de verdad es PostgreSQL. Preservar el comportamiento útil del tabulador existente.

## Orden de lectura para Codex

1. `AGENTS.md` (en raíz).
2. `docs/01-VISION-Y-ALCANCE.md`.
3. `docs/02-REQUISITOS-FUNCIONALES.md`.
4. `docs/03-FLUJOS-Y-REGLAS.md`.
5. `docs/04-MODELO-DE-DATOS.md`.
6. `docs/05-ARQUITECTURA-TECNICA.md`.
7. `docs/06-UX-UI.md`.
8. `docs/07-PDF-Y-PLANTILLAS.md`.
9. `docs/08-MIGRACION-LEGACY.md`.
10. `docs/09-SEGURIDAD-Y-CALIDAD.md`.
11. `docs/10-ROADMAP-Y-ACEPTACION.md`.
12. `docs/11-DECISIONES-PENDIENTES.md`.

## Primer arranque

- Inspeccionar `legacy/tabulador de precios v2.rar` y extraerlo en un directorio de análisis; no ejecutarlo a ciegas.
- Leer documentación, registrar hallazgos y dudas en `docs/11-DECISIONES-PENDIENTES.md`.
- Crear proyecto Next.js, esquema y migraciones, pruebas y flujos verticales reales.
- Mantener `docs/ESTADO.md` con avances, comandos, riesgos y próximos pasos.

## Definición de terminado

Los módulos están conectados a datos persistentes, probados, navegables y documentados. No basta con un diseño bonito o datos ficticios.

## Desarrollo iniciado

Código en src/, migraciones aditivas en supabase/migrations y pruebas en tests/. Consulta [estado real](docs/ESTADO.md), [guía de arranque](docs/GUIA-DESARROLLO.md), [auditoría del legado](docs/AUDITORIA-LEGACY.md) y [trazabilidad completa](docs/TRAZABILIDAD.md).

Arranque: npm ci, configurar .env.local a partir de .env.example, npm run db:migrate, npm run dev. Sin Supabase la interfaz muestra conexión pendiente; no simula datos guardados. No se ha desplegado ni migrado información real. El alcance integral continúa en desarrollo.

## Primera publicación en Netlify

Sitio existente: https://splendorous-gumdrop-81a528.netlify.app. Conexión al Supabase original configurada, Next.js Runtime oficial y Function Node 24 comprobados. Consulta [PUBLICACION_NETLIFY.md](docs/PUBLICACION_NETLIFY.md) para evidencias y pendientes de autenticación real. La migración 011 continúa sin aplicar y se requiere antes de utilizar las nuevas cargas de fotos.

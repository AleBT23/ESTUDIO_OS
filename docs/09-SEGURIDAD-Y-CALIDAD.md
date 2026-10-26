# 09 — Seguridad, calidad y operación

## Seguridad
Autenticación, sesiones seguras, control de acceso por organización y rol, RLS, validación servidor, CSRF según arquitectura, límites de tamaño y tipo de archivo, saneamiento de contenido enriquecido, URLs firmadas, rate limiting en puntos sensibles. Evitar filtrar datos entre usuarios/organizaciones. Registrar acciones críticas.

## Roles sugeridos
Propietario, administrador, colaborador y lector; permisos por acción y acceso a información financiera restringido por defecto. Si solo hay un usuario inicialmente, conservar estructura preparada para múltiples usuarios.

## Respaldo y recuperación
Backups periódicos de base y archivos, restauración ensayada, exportación manual JSON/CSV, migraciones reversibles cuando sea viable, política de retención y recuperación ante errores.

## Pruebas
- Unitarias: dinero, IVA, descuentos, márgenes, variables, permisos, atribución de líneas.
- Integración: crear cliente > cotizar > aceptar > proyecto > cobrar > extras > cerrar.
- E2E: navegación, formularios, PDFs, vistas, filtros y roles.
- Regresión PDF con fixtures; pruebas de páginas largas y fuentes españolas.
- Accesibilidad básica y rendimiento de tablas; pruebas de seguridad multi-tenant.

## Criterio de salida
`lint`, `typecheck`, `test`, `build` correctos; migraciones reproducibles; seed demo separado de producción; sin botones vacíos; registro de limitaciones reales. No publicar datos de clientes en ejemplos.

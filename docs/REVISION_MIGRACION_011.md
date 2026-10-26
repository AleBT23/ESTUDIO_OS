# Revisión de migración 011 — fotografías directas

Fecha: 26 de octubre de 2026. Resultado actualizado: revisión técnica favorable y respaldo real recuperado/verificado. Aplicación de 011 PENDIENTE de autorización expresa y preflight final.

Actualización posterior al informe inicial: ver [RESPALDO_Y_RECUPERACION_SUPABASE.md](RESPALDO_Y_RECUPERACION_SUPABASE.md). Se restauró la copia cifrada de D: en un proyecto Supabase aislado; origen sin escrituras y 011 sin aplicar en ambos proyectos. Las secciones siguientes conservan la evidencia de la revisión inicial; la antigua ausencia de respaldo ya está resuelta.

## Alcance y versión exacta

Archivo revisado: `supabase/migrations/202610260011_direct_project_photos.sql`.
SHA-256: `bac93222d36120cfa36ca9d2b12f2303e55944d068ae8d7ea633ed06e31d5b78`.

No se modificó la migración, la aplicación ni las migraciones anteriores. Solo se añadieron pruebas de revisión y este informe/estado. En Supabase se consultaron exclusivamente catálogos mediante una transacción READ ONLY con TLS/CA verificados. No se ejecutó 011, ensayo DDL, respaldo/restauración ni transacción de escritura sobre la base real.

## Preflight real comprobado

Registro local privado de metadatos: `.local/revision-011/preflight-2026-10-26T15-30-15.320Z.json`. No es un respaldo de datos.

- Diez migraciones registradas; sus SHA-256 coinciden con los archivos locales.
- 011 sin registrar; bucket temporal, funciones nuevas y nombres de políticas nuevos ausentes.
- RLS activo en storage.objects y public.project_photos.
- project_photos tiene actualmente photo_prepare (INSERT) y photo_read (SELECT); no hay políticas UPDATE/ALL adicionales ni concesiones UPDATE a authenticated.
- La implementación real previa de private.project_photo_access coincide con la fuente de 010.
- Se conservaron localmente definición/ACL previas y políticas para comparación/recuperación dirigida. No se copiaron filas de clientes/proyectos/fotografías de la base real.

Esto comprueba los supuestos de compatibilidad actual; no equivale a ejecutar la migración en el servicio real.

## Aditividad y efecto en datos

Es aditiva en datos de negocio, pero NO es solo creación de objetos:

1. Inserta una fila nueva de configuración de bucket privado, sin sobrescribir un bucket existente.
2. Añade helpers/políticas y el RPC prepare_project_observation.
3. Reemplaza private.project_photo_access para permitir al autor con rol de escritura leer copias definitivas todavía no publicadas (necesario para reintentos/limpieza).
4. Concede UPDATE exclusivamente de byte_size, limitado por RLS a fotos preparadas del autor.
   No hay UPDATE/DELETE de datos existentes de proyectos, observaciones o fotos durante la migración. Los INSERT en tablas de negocio están dentro del cuerpo del RPC: solo actúan cuando se invoca posteriormente.

La prueba de actualización aplica 001–010, crea filas sintéticas publicadas y pendientes, toma una copia completa en memoria y aplica 011. Compara todas las tablas public y los metadatos Storage: igualdad exacta y de hash salvo la nueva fila de bucket. No cambian PK, FK, restricciones, columnas ni archivos existentes.

## RLS, permisos y RPC

| Recurso                  | Lectura                                                                | Creación/cambio                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Temporal privado         | Solo autor con owner/admin/collaborator y proyecto/observación activos | Carga únicamente en ruta registrada y antes de publicar. Sin UPDATE/upsert. Autor puede limpiar su temporal después de publicar. |
| Definitivo preparado     | Solo autor con rol de escritura                                        | INSERT/DELETE según controles de 010; byte_size solo en su borrador. No mover ruta/organización/observación.                     |
| Definitivo publicado     | Owner/admin/collaborator/reader de su misma organización               | Continúa sin UPDATE/DELETE y sin nuevas fotos.                                                                                   |
| Otra organización o anon | Sin acceso a bytes                                                     | Sin carga/borrado/cambio autorizado por 011.                                                                                     |

Las fotos publicadas son compartidas entre miembros AUTORIZADOS del estudio, no exclusivas de su autor. Los metadatos de project_photos ya eran visibles para miembros de su organización desde 010; 011 no amplía esa lectura.

Los helpers SECURITY DEFINER fijan search_path vacío y usan nombres cualificados; los nuevos EXECUTE se revocan de PUBLIC y anon. El reemplazo conserva los ACL previos comprobados. El RPC:

- comprueba membresía/rol, pertenencia y vigencia del proyecto;
- valida texto, fecha según zona del estudio, UUID, máximo cinco tamaños y rango 1–2 MiB;
- serializa por organización/UUID con bloqueo asesor;
- prepara observación/fotos en una transacción e impide reutilizar UUID ajenos;
- conserva orden estable de fotos y admite cero fotos;
- no publica ni sobrescribe archivos.

Las políticas restrictivas de Storage continúan bloqueando accesos indebidos incluso al simular políticas permisivas adicionales. El permiso nuevo sobre byte_size depende de que no se introduzcan después otras políticas UPDATE/ALL permisivas en project_photos: el preflight real confirma que hoy no existen; repetir este control antes de aplicar.

Límite importante: RLS controla identidad y alcance; no decodifica JPEG. La validación de bytes/normalización está en el servidor. Los RPC de publicación y permisos directos ya existentes en 010 no constituyen por sí solos una atestación criptográfica de que un archivo pasó por sharp. La inspección de la API Auth/Storage real en staging sigue pendiente. Los roles administrativos de base y service_role conservan su capacidad de eludir RLS; no deben exponerse al cliente.

## Ensayo aislado y recuperación comprobados

Prueba: `tests/migration-011.test.ts`; usa exclusivamente PGlite en memoria, sin leer .env ni conectarse a Supabase.

- Diez casos nuevos: rollback de fallo, colisión de bucket, preservación de datos previos, restauración de copia anterior, ACL/search_path, matriz de miembros, autor/borradores, políticas Storage permisivas adicionales, retirada de permisos y UUID ajenos.
- Se provocó un fallo después del DDL y ROLLBACK recuperó exactamente datos, funciones, políticas y permisos anteriores.
- Se restauró dumpDataDir de PGlite en otra instancia aislada: recuperó las filas/función de 010 y la ausencia de objetos nuevos.
- Colisión de bucket produce error y deja la configuración previa intacta; no se usa ON CONFLICT para ocultarla.
- `npm test -- tests/migration-011.test.ts tests/database.test.ts`: 50 pruebas correctas.
- Suite completa: **109 pruebas en 15 archivos**; lint y typecheck correctos.

En la revisión inicial, la restauración ensayada era SOLO de una copia SINTÉTICA PGlite. La tabla storage.objects se representa en pruebas; no hay binarios de Storage ni autenticación JWT real. No afirmar que el respaldo productivo está creado/restaurado. No se repitió build porque no hubo cambios de aplicación/configuración.

## Respaldo previo: procedimiento inicial (ejecución completada posteriormente)

No se encontró un respaldo completo y restaurado en los artefactos revisados. Los JSON before-* contienen conteos/preflight y no permiten reconstruir la base. pg_dump, pg_restore, psql, Supabase CLI y Docker no están disponibles en PATH en esta sesión; no se instalaron ni se modificó PATH.

**No aplicar 011 con esos JSON como único respaldo.** Procedimiento previo:

1. Confirmar proyecto y ambiente, pausar temporalmente capturas de fotos y registrar hora/últimos movimientos para una copia consistente.
2. Usar una estación/herramientas autorizadas de backup. Seguir la exportación oficial de Supabase de roles, esquema y datos; verificar explícitamente public, private, datos Auth necesarios, configuración/metadatos de Storage y el historial propio estudio_migrations.applied (NO confundirlo con supabase_migrations). Si la herramienta excluye esquemas gestionados, exportar/recrear aparte sus datos y nuestras políticas/triggers/ACL según el procedimiento oficial. No copiar claves a Git o al chat.
3. Descargar aparte todos los objetos de los buckets privados existentes mediante Storage, incluyendo PDFs y fotografías; guardar manifiesto bucket/ruta/tamaño/SHA-256 y configuración de los buckets. Un dump SQL contiene metadatos, NO esos binarios.
4. Guardar dumps/manifiestos/objetos fuera del repositorio publicable y en una segunda ubicación privada cifrada, sin sobrescribir respaldos anteriores. Registrar checksums, fecha y versión de herramientas.
5. Restaurar el conjunto en un destino Supabase/PostgreSQL aislado compatible; ensayar también recuperación de objetos. No restaurar encima de la base real. Verificar conteos/hashes/FK, historial, funciones/políticas/ACL, accesos autorizados y lectura de PDF/fotos recuperados.
6. Documentar resultado y ubicación protegida. Solo un respaldo cuya recuperación se compruebe levanta este bloqueo.

No se puede dar una orden universal de restore sin conocer la herramienta y el destino elegidos: los esquemas gestionados y los objetos Storage requieren pasos específicos. No se promete que un dump estándar incluya todo.

## Aplicación futura, solo con autorización explícita

1. Repetir preflight: mismo destino/TLS, diez checksums intactos, 011 ausente, nombres libres, RLS/ACL sin deriva, respaldo restaurado disponible.
2. Confirmar aprobación para EXACTAMENTE el SHA-256 anterior. No instalar software ni cambiar configuraciones de producción por implicación.
3. En sesión administrativa revisada, ejecutar SOLO 011 y registrar su checksum en estudio_migrations.applied dentro de una misma transacción, con bloqueo del migrador y límites de espera. No cambiar APP_ENV para eludir la guarda de producción del migrador.
4. Antes de COMMIT, verificar invariantes de datos, bucket privado JPEG/2 MiB, RLS, EXECUTE de anon/PUBLIC retirados y permiso por columna/autor. Si algo falla, ROLLBACK.
5. Tras COMMIT, comprobar Auth/Storage con identidades y datos de prueba autorizados, lectura de archivos anteriores y aislamiento. Activar el nuevo formulario/reiniciar Next solamente después de validar.
6. Si aparece una incidencia después de COMMIT, pausar nuevas cargas y preferir una corrección dirigida revisada. No DROP CASCADE, borrado de buckets/archivos ni eliminación automática del historial. Cualquier restauración real exige plan para conservar movimientos posteriores y nueva autorización; primero restaurar/verificar en destino aislado.

La aplicación Netlify, sus variables, Supabase Auth Site URL y el despliegue definitivo quedan fuera de esta revisión.

## Referencias oficiales

- [Respaldos Supabase y exclusión de binarios Storage](https://supabase.com/docs/guides/platform/backups).
- [Backup/restore, historia y personalizaciones de esquemas gestionados](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
- [Políticas de acceso de Storage](https://supabase.com/docs/guides/storage/security/access-control).

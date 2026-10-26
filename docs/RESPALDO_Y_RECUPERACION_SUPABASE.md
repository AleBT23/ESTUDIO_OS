# Respaldo y recuperación comprobados — Supabase

Fecha: 26 de octubre de 2026. **Recuperación real satisfactoria en Supabase aislado. Migración 011 NO aplicada.**

## Identidad, alcance y evidencias

- Origen: estudio-os-dev, referencia iswyrxuoqgyuvhzyjnqn. Todas las consultas de esta operación fueron transacciones READ ONLY, con TLS y CA verificada; pg_dump usó también default_transaction_read_only=on.
- Destino autorizado: ESTUDIO OS - RECUPERACION 2026-10-26, referencia xuzcefjadowmwqdjztxq. Antes de escribir se comprobaron la referencia en la conexión, puerto 5432, ausencia de tablas públicas, usuarios Auth, buckets y registros propios de migración. El código rechaza la referencia del origen. El archivo suministrado contenía una URI sola; se interpretó sin modificarlo ni imprimir credenciales.
- PostgreSQL 17.11 y las cinco extensiones coincidentes, incluido supabase_vault 0.3.1; no se simuló Vault. No había secretos Vault.
- Snapshot consistente exportado el 2026-10-26T16:45:50.987Z, finalizado a las 16:46:34.943Z. Identificador de carpeta: supabase-2026-10-26T16-34-27Z; su nombre identifica la preparación, no la hora exacta del snapshot.
- Copia local: C:\Users\aleja\Desktop\ESTUDIO_OS\.local\backups\supabase-2026-10-26T16-34-27Z
- Segunda copia, **utilizada efectivamente para restaurar**: D:\COPIA_ESTUDIO_OS\supabase-2026-10-26T16-34-27Z
- Clave AES separada: C:\Users\aleja\Desktop\ESTUDIO_OS\.local\backup-keys\supabase-2026-10-26T16-34-27Z.key. Su contenido nunca se imprimió ni se incluyó en D:. Conservar otra copia de esta clave en una ubicación segura separada: perderla vuelve irrecuperables ambos respaldos cifrados. D: no está verificado como copia externa/offsite.
- Directorios privados con herencia de ACL deshabilitada y acceso del usuario Windows actual y SYSTEM; .local y secretos excluidos de publicación. No se cambiaron .env.local, claves de producción, Auth Site URL ni configuración de la aplicación.

## Contenido real del respaldo

Dump nativo completo custom de pg_dump 17.11, dump adicional de public/private/estudio_migrations, roles y membresías sin contraseñas de roles administrados, catálogo/huellas, inventario Storage y configuración local cifrada. Se conservaron 66 tablas y 341 filas del snapshot. Las credenciales/hash de usuarios Auth están protegidos dentro del dump cifrado; las contraseñas de conexión de los roles del proveedor no se reemplazan en el destino.

Cada artefacto sensible está cifrado con AES-256-GCM, IV aleatorio, autenticación GCM y SHA-256 de texto plano/cifrado para los siete artefactos originales. No se escribieron dumps SQL descifrados a disco; restauración por memoria/stdin. El kit operativo también está cifrado, sin incluir la clave de descifrado ni la conexión de recuperación.

Storage tenía **dos buckets privados y cero objetos**, verificado mediante acceso administrativo y guardado en storage-manifest.json.enc. Se restauró la configuración exacta de los buckets y se verificaron cero objetos en destino. No existían fotografías/PDF binarios que descargar ni restaurar; este ensayo no acredita la descarga de un archivo inexistente. Cuando existan objetos, será obligatorio añadir sus bytes, rutas, tamaños y hashes por separado: pg_dump no guarda esos binarios.

## Restauración efectivamente ejecutada

1. Autenticación/descifrado de la copia de D:, comprobación previa de destino vacío y versiones.
2. Extracción selectiva del archivo nativo mediante pg_restore --list/--use-list/--file=-, sin --clean, DROP ni TRUNCATE.
3. Restauración mediante psql --no-psqlrc --single-transaction --set=ON_ERROR_STOP=1 --file=-. session_replication_role=replica únicamente en la sesión del destino durante COPY; vuelta a origin antes de verificar. Datos Auth y buckets, esquema/datos propios y políticas Storage, sin ejecutar 011. Antes del commit se comprobaron conteos y SHA-256 de las 63 tablas ajenas a los tres historiales internos del proveedor.
4. Los historiales auth.schema_migrations, realtime.schema_migrations y storage.migrations se archivaron íntegros y se conservaron los del nuevo proyecto. Sus versiones corresponden al mismo entorno; sus filas se compararon con el baseline del destino. No se sobrescribió la historia de instalación del proveedor. **estudio_migrations.applied sí se restauró exactamente: diez nombres/checksums/fechas.**
5. Las ACL de objetos propios se repusieron desde el catálogo del snapshot, incluyendo 52 concesiones por columna. No se intentó cambiar contraseñas/roles administrados. Se compararon privilegios efectivos: ACL NULL y ACL explícita equivalente se interpretan con los valores predeterminados documentados de PostgreSQL.
6. Verificación independiente posterior exclusivamente READ ONLY: hashes, datos, estructura, permisos, RLS y almacenamiento. Se generaron recovery-verification.json y final-checks.json en ambas copias.

Incidencias resueltas durante el ensayo: COPY de buckets_vectors vacío fue denegado por Supabase; se omitió COPY de tablas administradas vacías, verificando que permanecen vacías. ALTER DEFAULT PRIVILEGES de roles administrados fue denegado; se conservaron los 24 valores predeterminados, ya idénticos al origen. Ambos intentos fallidos se revirtieron antes de reintentar. Los objetos públicos recién creados heredaban permisos extra de los defaults actuales; se retiraron en el destino y se restauraron únicamente las concesiones originales, incluidas las de columna. Ninguna reparación se ejecutó en el origen. Los registros detallados quedaron cifrados.

## Resultados comprobados

| Verificación | Resultado |
| --- | --- |
| Tablas | 66 comprobadas; 63 por conteo/hash del snapshot y tres historiales del proveedor contra baseline |
| Filas restauradas ajenas a los historiales del proveedor | 94, idénticas al respaldo |
| Políticas RLS | 54 coincidentes, incluidas 16 de Storage |
| Relaciones y funciones | 293 relaciones y 127 funciones coincidentes; propietarios y permisos efectivos preservados |
| Privilegios de columna | 5,143 coincidentes |
| Roles / membresías / defaults | 14 / 24 / 24 coincidentes |
| Secuencias / extensiones / esquemas | 2 / 5 / 10 coincidentes |
| Migraciones propias | Diez registros idénticos; checksums locales coincidentes; 011 ausente |
| Restricciones / columnas / índices / triggers propios | 189 / 291 / 77 / 16 coincidentes |
| Opciones de relaciones / etiquetas enum | 107 / 4 coincidentes |
| Publicaciones / ACL de la base | Coincidentes; publicación sin tablas, igual al origen |
| Storage | Dos buckets privados idénticos, cero objetos |
| Seguridad funcional | Propietario lee proyectos; usuario ajeno no ve proyectos/membresías y no pertenece a la organización; anónimo sin lectura; ruta fotográfica inexistente denegada |
| Origen al cierre | READ ONLY; ninguna de las 66 tablas cambió respecto al snapshot; diez checksums válidos y 011 ausente |

El certificado de recuperación se emitió a las 2026-10-26T17:06:52.481Z y la comparación final de estructura/origen a las 17:07:45.858Z. backup-manifest.json y copy-verification.json conservan recoveryVerified=false porque son registros originales de la fase de exportación; **el resultado posterior está en recovery-verification.json y final-checks.json**. No se sobrescribieron respaldos anteriores.

## Procedimiento conservado para una recuperación futura

Mantener juntos los archivos cifrados y certificados de D:, y mantener **separada** la clave. recovery-consolidated.sql.enc reúne el SQL de las fases ejecutadas y verificadas, con las correcciones de ACL; no se volvió a lanzar entero sobre el destino ya poblado. recovery-operator-kit.json.enc conserva los scripts privados. Se necesita Node 24, psql 17.11 y un destino Supabase vacío compatible. Los ejecutables portables están en .local/tools/postgresql-17.11/pgsql; no se instaló servicio ni se modificó PATH.

Formato de cifrado recuperable con herramientas estándar: cabecera ASCII ESTUDIO_OS_BACKUP_V1 seguida de LF; IV de 12 bytes; ciphertext; tag GCM final de 16 bytes. La clave es base64 y decodifica a 32 bytes. El descifrador decrypt-artifact.mjs incluido en la copia solo usa módulos integrados de Node y rechaza sobrescribir la salida. Extraer texto plano únicamente dentro de una carpeta privada, nunca a repositorio/carpeta compartida. El kit conserva los parámetros de este ensayo; revisar rutas y allowlist contra el destino autorizado antes de reutilizarlo en otro equipo/proyecto.

En el equipo actual, las herramientas revisadas están en .local/recovery-helpers.mjs, .local/recovery-access.mjs, .local/restore-verified-backup.mjs, .local/verify-isolated-recovery.mjs y .local/final-recovery-checks.mjs. **No ejecutar de nuevo la restauración contra el proyecto poblado**: la guarda de vacío debe detenerla. No apuntar el restaurador al origen ni ejecutar automáticamente roles.sql sobre Supabase administrado. El verificador original genera certificados exclusivos y rechaza reemplazarlos; para un nuevo ensayo deben usarse un identificador y carpeta nuevos.

Restaurar SQL/ACL mediante stdin en una única transacción; repetir las verificaciones independientes antes de promover cualquier destino. Con futuros archivos Storage, recuperar además los binarios mediante la API de Storage con sus hashes y acceso privado. La restauración real de producción, cambios DNS/URLs o cambio de proyecto de la aplicación requieren un plan de corte y autorización aparte.

## Alcance y siguiente paso: 011

El bloqueo por falta de respaldo recuperable queda resuelto. La revisión técnica de 011 continúa favorable para el SHA-256 bac93222d36120cfa36ca9d2b12f2303e55944d068ae8d7ea633ed06e31d5b78. **Listos para solicitar autorización explícita para aplicar 011**, con preflight final inmediato; actualizar el respaldo si hay actividad posterior. No se aplicó 011 ni en origen ni en recuperación. Su ensayo real específico en este proyecto, si se desea, también debe autorizarse; las pruebas previas de 011 son sintéticas PGlite.

La copia del estado SQL de Auth está verificada; no se ensayó iniciar sesión con contraseña ni renovar JWT contra la API del clon. No se modificaron configuración Auth/proveedores, claves del nuevo proyecto ni URLs de producción, y no se conectó la aplicación al clon. Este ensayo no certifica todavía el despliegue Netlify ni el flujo de carga de fotos posterior a 011. No se borró el proyecto de recuperación.

Referencias: [respaldo Supabase y Storage](https://supabase.com/docs/guides/platform/backups), [recuperación entre proyectos Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore 17](https://www.postgresql.org/docs/17/app-pgrestore.html).

# Estado de implementación

Actualización: **26 de octubre de 2026**. Plataforma integral en desarrollo; Supabase conectado. Sin despliegue público ni importación de datos del legado.

## Auditoría
- Documentación inicial completa leída; carpeta inventariada. RAR preservado y extraído para análisis sin inicializar tabulador.
- Inventario verificable en tests/fixtures/legacy-inventory.json; campos/hallazgos/exportación en AUDITORIA-LEGACY.md.
- Marca oficial inspeccionada y copiada sin modificaciones. Membrete carta 2550×3300; datos inferiores y franja derecha requieren reserva.
- Defectos legado: pct multiplica por 100 de más, ASCII pierde acentos, rentabilidad interna en PDF, sin snapshots. Caracterización monetaria ejecutada; equivalencia visual PDF no afirmada.

## Incremento 1 — base y clientes
- Next.js/React/TypeScript, Tailwind, botón shadcn/Radix; layout responsive, cinco áreas, configuración secundaria, foco y reduced-motion.
- Instalación pendiente, loading/error/404, recursos oficiales y bienvenida sin cifras ficticias. Otras áreas informan pendientes explícitos.
- Adaptador Supabase SSR, login/logout, sesión verificada servidor; alta transaccional del estudio con dos líneas configuradas. Sin registro público.
- SQL: organizaciones, membresías/roles, líneas, clientes, contactos y auditoría. RLS, FK compuestas, privilegios de columnas, índices, archivo y versión optimista.
- Clientes: creación, directorio paginado/búsqueda/filtros, ficha, edición, archivo/restauración y actividad; Zod y permisos servidor. Avisos de cambios no guardados. Falta validación UI contra Supabase real.
- Dinero exacto probado: IVA, descuento, porcentaje, anticipo programado con cobrado=0.
- Exportador legado solo lectura: JSON versionado/conteos/SHA-256 y validador. Importación pendiente.
- Scripts migración con transacciones/checksums y seed demo explícito; pruebas PostgreSQL embebido.

## Pruebas y errores
- Lint correcto tras corregir exportación anónima PostCSS.
- Typecheck correcto. 30 pruebas correctas: dinero, validación/permisos, legado y PostgreSQL/RLS.
- Build Webpack correcto con permisos del entorno. Turbopack falló en subproceso PostCSS y Webpack sandbox en mkdir .next (EPERM); alternativa verificada y documentada.
- E2E/capturas en preparación; no afirmar login remoto ni aceptación del bloque.
- npm audit: 5 alertas altas transitivas de lint (braces/fast-glob/eslint-config-next); sin versión braces corregida publicada al consultar. No downgrade mayor automático; evaluar alternativa. No afirmar cero alertas.

## Incremento 2 — comercial y continuidad documental
- Catálogo real: clave única, categoría, línea, unidad, precio/costo, descripción, vigencia, edición y archivo/restauración. Presets transaccionales con cantidades; editor rápido/completo de cotizaciones, partidas por línea, descuento/IVA opcional, condiciones, vigencia y anticipo. Se copian precios/alcances sin modificar catálogo.
- Cálculos repetidos de forma exacta en PostgreSQL y comparados con motor decimal. Operación de guardado de propuesta/preset transaccional: una referencia inválida revierte cabecera/partidas, sin reemplazo parcial. Importes y referencias rechazados en servidor/BD.
- Nuevas migraciones 002–004 y componentes comerciales/documentales/financieros. Todas son nuevas y solo se han aplicado en BD de pruebas; ninguna migración aplicada remotamente fue modificada.

## Incremento 3 — PDF, aceptación y primer cobro
- DocumentRenderer desacoplado, React PDF con Noto Sans libre embebida (licencia conservada). PNG oficial carta; márgenes independientes dentro de límites seguros calibrados; portada/agradecimiento/alcance/presupuesto/condiciones/firmas activables y reordenables. Presupuesto obligatorio.
- Vista previa del borrador guardado mediante PDF real. Tabla multipágina con encabezado repetido, filas indivisibles/continuaciones para descripciones largas; totales y firmas protegidos. Sin costos internos en snapshot público al cliente.
- Emisión: folio único por estudio/año, snapshot canónico BD, PDF privado, SHA-256, versión inmutable. Descarga verifica checksum y autorización. Storage impide actualizar/borrar PDFs emitidos, incluso ante otras políticas permisivas. Limpieza de archivo preparado si falla confirmación. Preparación repetida con opciones distintas se rechaza; guardar nueva edición para cambiarlas.
- Registrar envío es una acción manual explícita; NO envía correo. Aceptación transaccional de la versión enviada crea proyecto mixto, paquetes por línea, presupuesto neto segregado y obligaciones de anticipo/saldo. No crea cobros.
- Directorio/ficha de proyectos y paquetes persistentes. Administración muestra obligaciones y movimientos reales; cobros idempotentes, rechazo de sobrepago/fecha futura y reversos con motivo, versión y auditoría. Información financiera restringida a owner/admin; colaboradores ven expediente/alcances sin importes.
- **Validación del incremento 3:** 48 pruebas unitarias/SQL/PDF correctas. Hito SQL B: 25,000 MXN, anticipo 12,500, saldo 12,500, cobrado 0; registro/reverso posterior mantiene trazabilidad. Pruebas Storage/RLS/snapshots incluidas. Esto no sustituye E2E remoto Supabase.
- PDF: reabierto con PDF.js/pypdf, carta 612×792 pt y Unicode verificado. Fixtures de una página y 12 páginas (45 partidas + seis secciones). Se detectó numeración fuera de página; el nodo dinámico del renderer fue sustituido por posprocesado pdf-lib. Ahora pruebas verifican número de todas las páginas, coordenadas, fondo/encabezado y 45 conceptos completos. Las 12 páginas se inspeccionaron visualmente; numeración, totales y firmas revisados tras corrección. Las muestras son sintéticas, no documentos de clientes reales. Poppler emitió aviso de fuente estándar Symbol del entorno, sin defectos visibles en render final.
- 5 pruebas E2E de instalación/navegación/móvil/marca correctas; nuevas rutas protegidas y flujos autenticados aún requieren Supabase real. Las capturas iniciales coincidieron con animación de entrada; se desactiva animación solo en capturas de prueba para revisión estable.
- Código formateado con Prettier. Se conserva revisión de lint/typecheck/test/build por incremento.

## Incremento 4 — pipeline y contactos
- Pipeline persistente con seis etapas y vista Kanban, filtro de línea, notas, próximo seguimiento y señal de fechas vencidas/hoy. Formulario de creación/actualización con versión optimista, validación y RLS. No representa un centro de notificaciones terminado.
- Contactos por cliente: alta/edición, cargo/correo/teléfono, archivo y restauración. Pruebas de versiones, relación y recuperación. Límite de 200 contactos por ficha documentado como pendiente de paginación.
- Pruebas ampliadas: referencias de oportunidades, etapas, versiones, conservación de contactos y bloqueo de Storage ante políticas anónimas amplias.
- Git local inicializado en main, sin commits ni remoto. Código e identidad originales conservados; .env y extracción excluidos de Git.
- Auditoría npm de producción (omit=dev): 0 vulnerabilidades reportadas. Persisten 5 altas transitivas de herramientas lint; no ocultadas ni aplicadas correcciones mayores sin evaluación.

## Pendientes por roadmap
### Continuación autorizada sin Supabase
El usuario confirmó que aún no tiene proyecto Supabase y autorizó continuar preparando la aplicación. No volver a solicitar credenciales para trabajo independiente; mantener pendiente Auth/Storage/E2E remoto y no simular persistencia.

Incremento 5: biblioteca comercial de conceptos con alta, búsqueda/paginación, edición con versión, archivo/restauración e inserción de texto por copia en partidas. Estimación monetaria exacta de resultado sin costo de horas, margen e ingreso previsto por hora, con fórmulas visibles y casos de pérdida/cero.

Incremento 6: migración 006 aditiva y controles de rechazo, vencimiento y revisión. Motivo e historial persistidos; se valida vigencia y versión; PDF anterior inmutable; cotizaciones aceptadas no se reabren. 57 pruebas y lint/typecheck/build correctos al cerrar estos incrementos. Guardas de la nueva ruta de conceptos verificadas en el E2E final.

Incremento 7 preparado y probado localmente: documentos independientes con variables seguras y membrete (DOC-04, corte vertical del hito F). Cartas/oficios/minutas/reportes, borradores editables, cliente/proyecto opcionales, márgenes por documento, preview PDF guardado, emisión privada/versiones/descarga con checksum. Listado paginado y editor con inserción de variables, subtítulos, listas y saltos. Contexto de cliente/proyecto coherente, datos faltantes detienen render, no se ejecuta HTML ni se expanden variables recursivamente. Plantillas reutilizables, tablas/imágenes/adjuntos y archivo recuperable siguen pendientes.

Migración 007 crea studio_documents/generated_documents y amplía políticas de Storage conservando protección de cotizaciones y bloqueo anónimo. Cambiar borrador o cliente no altera snapshots/PDFs anteriores. Folios DOC/COT comparten contador por organización/año con prefijos distintos.

Comprobaciones del incremento: lint/typecheck y 66 pruebas correctos; build correcto con las nuevas rutas. PDF de minuta de 1 página y reporte de visita de 3 páginas generados con PNG real, reabiertos con PDF.js/Poppler y revisados visualmente: acentos, membrete, área útil, contenido final y numeración correctos. Muestras sintéticas; no son expedientes reales. E2E final: cinco pruebas correctas de navegación/móvil y guardas de conceptos, documentos y APIs PDF sin sesión.

1. Base: configurar Supabase/aplicar las siete migraciones y E2E Auth/Storage reales. Usuarios/roles editables, ajustes de estudio, backup/restore y rate limiting completo.
2. Comercial: archivos/interacciones completas, presets documentales/condiciones, atribución completa de costos, validación remota y archivos. Marketing pendiente. Listados/selecciones grandes requieren paginación remota. Ver TRAZABILIDAD.md para todos los IDs.
3. Documentos: plantillas reutilizables/versionadas, tablas/imágenes, membretes múltiples privados/carga/ajuste/guías y anexos. PDF básico implementado/probado; equivalencia legado y muestras reales pendientes.
4. Producción: edición completa de expedientes/paquetes, fases/plantillas, tareas/dependencias/vistas, entregables/revisiones y extras. Conversión básica mixta implementada.
5. Administración: editor de planes/parcialidades/cancelaciones, gastos, colaboradores/repartos, tiempo, rentabilidad y CSV. Registro de cobros/reversos/consulta de saldos implementados; E2E remoto pendiente.
6. Recursos/marketing: biblioteca, procedimientos/checklists, contenido y portafolio. Identidad y documentos independientes disponibles; biblioteca/procedimientos/marketing siguen pendientes.
7. Inicio: KPIs reales, filtro persistente línea/periodo, búsqueda global, favoritos, notificaciones/reportes. Inicio actual es bienvenida, no dashboard terminado.
8. Migración: datos navegador original, validación staging/duplicados/reconciliación, PDFs, respaldo/restauración, aceptación y despliegue.

## Continuidad
Verificación final del incremento: lint y typecheck correctos; 66 pruebas unitarias/SQL/PDF y 5 E2E correctos; build Webpack correcto. Capturas escritorio/móvil revisadas tras desactivar animación en las capturas; sin desbordamiento. Se deja servidor local de revisión en http://127.0.0.1:3000. No es despliegue público.

Última corrección monetaria: formatear centavos con división flotante podía perder un centavo cerca del máximo seguro. Ahora usa BigInt para parte entera/fracción y formato regional; prueba del máximo 90,071,992,547,409.91 y -0.01. Se repitieron lint, typecheck, test y build.

Comandos en GUIA-DESARROLLO.md: npm ci, dev, lint, typecheck, test, build, test:e2e, db:migrate, audit:legacy.
Se solicitó configurar URL/clave pública Supabase en .env.local sin compartir secretos. No se recibieron credenciales ni se conectó entorno real. Se continúa con tareas independientes.
Sin datos reales creados, migraciones destructivas, publicación, commits o credenciales inventadas. Mantener RAR/navegador original intactos. Repositorio local nuevo en main.

## Verificaciones
- [x] Lint
- [x] Typecheck
- [x] Pruebas unitarias y SQL
- [x] Build
- [x] Migraciones reproducidas en PostgreSQL embebido
- [ ] Migraciones y validación Supabase real
- [x] PDF sintético: render visual y reapertura
- [ ] PDF y aceptación con datos reales

## Verificación de configuración Supabase — 19 de octubre de 2026

El usuario confirmó que creó su proyecto y configuró variables locales. Esta actualización sustituye el pendiente histórico de crear el proyecto; la conexión completa sigue pendiente de verificación. No se muestran ni registran valores, claves, contraseñas ni identificadores del proyecto.

- `.env.local` contiene exactamente los cuatro nombres de `.env.example`, sin duplicados. URL y clave publicable presentes; APP_ENV válido en development. DATABASE_URL presente pero vacía. Archivo ignorado por Git y no incluido en su índice.
- La URL configurada incluye el sufijo `/rest/v1`; el adaptador SSR y el proxy necesitan la URL base del proyecto. No se modificó el archivo local: retirar ese sufijo antes de repetir las pruebas de aplicación.
- Comprobaciones remotas exclusivamente GET sobre la URL base, con red habilitada: Auth settings respondió HTTP 200; raíz de Data API respondió HTTP 401 tanto con apikey como con las cabeceras equivalentes del cliente. El 200 acredita disponibilidad de Auth, no un inicio de sesión ni la correcta configuración completa. El 401 queda sin diagnóstico concluyente: confirmar clave publicable del mismo proyecto y repetir tras corregir URL. No se consultaron registros de negocio ni se creó usuario/sesión.
- La primera comprobación bajo restricciones de red falló en DNS; la repetición autorizada fuera de esa restricción alcanzó los servicios. No confundir el fallo inicial del entorno con un fallo del proyecto.
- Siete archivos SQL y script de migración comprobados. NO se ejecutó db:migrate: incluso su inicialización crea esquema/tabla de seguimiento. PostgreSQL no se intentó conectar porque falta su cadena privada.
- Para continuar: configurar DATABASE_URL localmente desde Connect (directa o Session pooler para IPv4), contraseña de BD codificada en la URI y TLS con verificación de certificado; mantener secretos fuera del chat. Después verificar en solo lectura proyecto destino, conectividad, permisos DDL/Storage, esquemas auth/storage, roles, conflictos de objetos/bucket y registro/checksums de migraciones. Preparar respaldo y recuperación antes de autorizar ejecución. Las transacciones del script son por archivo: una falla posterior no revierte los archivos anteriores ya confirmados.
- Sin cambios de código, variables locales o datos remotos; no se ejecutaron pruebas funcionales ni se afirmó conexión PostgreSQL/Auth/Storage completa. Tras corregir variables, reiniciar desarrollo o reconstruir/reiniciar la vista productiva para que use la configuración actual.

## Intento de conexión y migración real — 19 de octubre de 2026

- El usuario autorizó aplicar las siete migraciones únicamente tras preflight satisfactorio. Las cuatro variables tienen formato esperado, URL base corregida, APP_ENV=development y DATABASE_URL completa. Host/usuario PostgreSQL corresponden al identificador del proyecto de la URL API; no se registran valores. Conexión configurada no usa puerto de transaction pooler.
- HTTPS con validación TLS: Auth settings HTTP 200; Data API raíz HTTP 401 tanto con apikey como con cabeceras equivalentes al cliente. Disponibilidad Auth confirmada; autenticación de usuario y acceso Data API no verificados. No atribuir el 401 a una causa no demostrada.
- PostgreSQL con rejectUnauthorized=true falla en SELF_SIGNED_CERT_IN_CHAIN antes de ejecutar consultas. Repetición con Node --use-system-ca también falla. No se desactivó validación TLS. Se necesita certificado raíz oficial del proyecto y configurar su CA explícitamente en el cliente antes de continuar.
- Revisión indispensable de siete archivos/script: RLS y privilegios por roles, bucket privado PDF, políticas restrictivas de Storage y registro/checksums por transacción. No sustituye comprobación remota: todavía NO se pudo verificar que la BD esté vacía, permisos efectivos, conflictos, tablas, bucket ni registro de migraciones.
- Migraciones aplicadas en este intento: **0 de 7**. Sin escrituras remotas, usuarios de prueba, datos sintéticos, cambios al legado o a .env.local. No se ejecutó db:migrate ni pruebas funcionales dependientes de una conexión válida.
- Bloqueo que requiere al propietario: guardar certificado raíz descargado desde configuración Database/SSL de Supabase en `.local/supabase-ca.crt` (ruta ignorada por Git); confirmar clave publicable vigente del mismo proyecto y revisar Data API habilitada. No compartir contraseña/clave por chat. Después configurar CA en el cliente/migrador, repetir preflight de solo lectura, respaldar estado inicial y continuar migraciones solo si todas las comprobaciones son satisfactorias.

## Certificado configurado y diagnóstico de acceso — 19 de octubre de 2026

- Certificado oficial presente. Migrador configurado con CA explícita desde `.local/supabase-ca.crt`, rejectUnauthorized=true y límite de conexión de 15 segundos. Ninguna desactivación de TLS/RLS; certificado y secretos excluidos de Git. `.env.example` indica la ubicación del certificado sin añadir credenciales.
- Preflight con la CA superó la validación TLS y alcanzó autenticación PostgreSQL: error **28P01** (credenciales rechazadas). URL base correcta, APP_ENV=development y host/usuario PostgreSQL corresponden al mismo proyecto que la API. No se imprimieron valores ni errores crudos. No fue posible consultar catálogos, confirmar ausencia de datos/conflictos ni permisos efectivos.
- Auth settings devuelve HTTP 200 con la clave configurada; control con clave deliberadamente inválida devuelve 401, confirmando que el acceso con la clave configurada sí se acepta.
- **401 de Data API diagnosticado:** la raíz `/rest/v1/` responde que requiere clave secreta para OpenAPI. No se necesita ni se añade clave secreta a la aplicación. Consulta REST normal `organizations`, sin solicitar filas (limit=0), devuelve HTTP 404/PGRST205: clave publicable aceptada, tabla no disponible en caché de esquema antes de migrar. Esta prueba no demuestra que toda la base esté vacía.
- Migraciones aplicadas en este intento: **0/7**. No se ejecutó el migrador ni se modificaron datos remotos/legado/.env.local; el usuario debe corregir la contraseña de BD de DATABASE_URL usando Connect del mismo proyecto y codificar caracteres reservados. Si no conoce la contraseña, restablecer la contraseña de Database (no la clave publicable) desde Supabase y actualizar la URI local. Después repetir preflight y continuar las siete migraciones autorizadas solo si el destino es seguro.
- Validación tras configurar TLS en migrador: lint y typecheck correctos; **66 pruebas de 9 archivos correctas** (unitarias/SQL embebido/PDF). No equivalen a validación remota de tablas/RLS/Storage, pendiente de autenticar PostgreSQL.

## Supabase operativo — 19 de octubre de 2026

- Contraseña corregida: PostgreSQL autenticado, destino coincide con URL/usuario de proyecto y APP_ENV=development. TLS del cliente cifrado y autorizado con CA oficial (comprobado en socket TLS); pg_stat_ssl del servidor refleja el tramo interno del pooler, no el TLS cliente→pooler. No se desactivó verificación ni se registraron credenciales.
- Preflight remoto: cero tablas públicas de aplicación, usuarios Auth, buckets, objetos y políticas Storage; sin esquemas propios previos. Ensayo de las siete migraciones completado en transacción revertida antes de ejecutar definitivamente. Los permisos efectivos sobre Storage se validaron con ese ensayo (la comprobación simple de pertenencia al propietario no refleja toda la autorización de Supabase). Estado inicial vacío registrado sin identificadores/secretos en .local/supabase-pre-migration.json; no había datos de aplicación que respaldar.
- **Siete migraciones funcionales aplicadas en orden**, sin modificar archivos ya registrados. Comprobación remota encontró grants explícitos de Supabase a anon en RPC, que REVOKE FROM PUBLIC no elimina. Añadida/aplicada **008_rpc_permissions**, solo revoca ejecución anónima/PUBLIC en funciones propias y conserva authenticated. No modifica datos ni permisos de extensiones. Prueba de regresión reproduce privilegios predeterminados reales de Supabase.
- Resultado final: **8 registros/checksums coincidentes**, **23/23 tablas con RLS**, **32 políticas públicas y 8 de Storage**. Bucket estudio-documents privado, solo application/pdf y máximo 20 MiB; políticas restrictivas bloquean anonimato, sobrescritura y borrado de versiones emitidas. Vista de saldos security_invoker. Sin grants anónimos de lectura en clientes ni INSERT directo a snapshots; authenticated tampoco puede insertar snapshots ni actualizar documentos generados directamente. Las 13 RPC públicas propias admiten authenticated y ninguna anon.
- Pruebas reales: rol authenticated sin identidad no ve organizaciones/clientes/cotizaciones/objetos; RPC sin identidad rechazada; anon sin EXECUTE obtiene 42501. SDK Supabase real alcanza Data API y recibe el rechazo esperado 42501 tanto para lectura anónima como para RPC. Auth settings 200; raíz OpenAPI sigue requiriendo clave secreta, lo cual no bloquea el cliente publicable. No se añade ninguna clave secreta.
- Validación local: lint/typecheck/build correctos; **67 pruebas de 9 archivos correctas**. Primer intento de smoke de navegador falló en el arnés sin diagnóstico útil; repetición con selectores de campos comprobó acceso HTTP 200, campos correo/contraseña, redirección de ruta protegida a /acceso y móvil sin desbordamiento. No se afirmó login completo con usuario real.
- Servidor actualizado disponible en http://127.0.0.1:3000/acceso. Base sin usuarios, organizaciones ni datos ficticios. Siguiente paso del propietario: Supabase Auth → Users → Add user/Create user, crear su correo/contraseña (mínimo 8 caracteres) y confirmar correo; iniciar sesión y crear el espacio del estudio. El propietario introducirá sus datos en el formulario, sin compartirlos por chat. Falta validar CRUD/emisión/descarga con esa sesión real y respaldo/restore con datos reales antes de producción.
- Sin cambios al legado, borrados de datos, desactivación RLS/TLS, publicación pública o modificaciones a .env.local. El bloqueo de contraseña quedó resuelto.

## Cotizaciones: eliminación lógica y PDF Poppins — 19 de octubre de 2026

- Menú de acciones en listado y detalle, confirmación nativa modal con nombre/folio, foco inicial en conservar, bloqueo mientras procesa y aviso de resultado. Owner/admin pueden eliminar lógicamente con versión optimista; aceptadas o vinculadas a proyectos se conservan y ofrecen alternativa hacia Proyectos. Borrados fuera del listado/búsqueda activos y de preview; no se eliminan clientes, partidas, catálogo, obligaciones ni PDFs emitidos. Historial conserva evento archived. Recuperación visual futura pendiente; registros retenidos.
- Migración **009_quote_archive aplicada** tras ensayo revertido y verificación de checksums anteriores. RPC autorizada por organización/rol, sin grants anon/PUBLIC ni DELETE físico; trigger impide seguir operando una eliminada o archivar acuerdos con proyecto. Clave del servicio copiada al guardar nuevas partidas y snapshots futuros, sin modificar versiones previas; partidas manuales/históricas sin clave muestran guion, no una clave inventada.
- PDF de cotización: Poppins real Regular/Medium/SemiBold oficial de Google Fonts, licencia OFL conservada; @pdf-lib/fontkit 1.1.1 incrusta también la numeración. Escala 24/16/11/9 pt, seis columnas, jerarquía de cliente/proyecto/fecha y resumen. Membrete/datos profesionales/colores originales y cálculos intactos. Filas normales indivisibles; texto que excede una página usa continuaciones explícitas con ancho ampliado y sin repetir importes. Paginación medida con la fuente; cabeceras repetidas solo en páginas de conceptos, resumen sin cabecera de tabla huérfana y condiciones adyacentes reunidas cuando caben. Secciones opcionales y orden conservados. PDFs ya emitidos siguen descargándose inmutables.
- Verificación: **71 pruebas correctas**, lint/typecheck/build correctos y npm audit --omit=dev sin vulnerabilidades reportadas. Casos nuevos: rol/otro estudio, conflicto/doble eliminación, PDF y auditoría retenidos, aceptación bloqueada tras eliminar, aceptadas/obligaciones protegidas y clave de catálogo inmutable en snapshot. PDF reabierto: texto pintado en Poppins, tamaños, importes y límites comprobados; muestra extensa de nueve páginas marcada SIN VALIDEZ revisada visualmente completa con Poppler. Corregidos durante pruebas: conteo de RPC (ahora 14), clave ausente del snapshot, tipado de streams PDF y detección de Helvetica registrada solo en bloques vacíos del motor (ningún texto visible sustituido).
- Prueba Supabase real: archivo ejecutado con identidad de propietario en transacción completamente revertida; hash de cotizaciones antes/después idéntico. Se conservó el cliente/cotización existentes; sin datos de prueba persistentes. RLS y bucket privado activos, anon sin EXECUTE y authenticated sin DELETE. No se automatizó una sesión Auth real para confirmar el diálogo desde navegador.
- Servidor local actualizado. Muestra sintética en output/pdf/cotizacion-poppins-prueba.pdf (ignorada por Git). Para ver el diseño nuevo en una propuesta ya emitida, crear/emitir nueva revisión; nunca se regenera el archivo histórico. Sin cambios al legado ni credenciales.
- Smoke de navegador final: acceso HTTP 200, cotizaciones redirige a /acceso sin sesión y cero excepciones de página. Se corrigió la espera del arnés para observar la redirección de Next.js después del streaming; no fue un fallo de permisos.

## Móvil, pendientes y bitácora — 25 de octubre de 2026

- Cotizaciones y formularios adaptados a teléfono/iPad: campos de 16 px, controles táctiles de 44 px, partidas en una columna, tablas con desplazamiento contenido, áreas seguras, menú desplegable hasta 1024 px con foco/Escape y diálogos que caben en una vista reducida. Se conserva interfaz de escritorio y PDF existente.
- Preparados pendientes/notas por proyecto, edición, fecha, completar/reabrir y pendientes abiertos paginados en Inicio. Bitácora fechada con hasta cinco fotos privadas por registro, preparación ligera en navegador, validación/normalización JPEG y retirada de EXIF en servidor. Fotos publicadas inmutables, acceso autenticado sin caché y aislamiento por organización. HEIC depende del decodificador del navegador; si falla se solicita una copia JPEG, sin simular éxito.
- Proyectos manuales sin cotización ficticia, importe acordado opcional/definición posterior, resumen económico agregado en BD y cobros/anticipos con fecha real dentro del expediente, reutilizando planes/movimientos/reversos existentes. No se interpreta el importe acordado como costo interno ni se registra anticipo cobrado automáticamente. Creación y cobros idempotentes; el cliente conserva entrada tras errores. Versión cargada de cotización congelada para evitar pisar cambios del PC, y refresco al volver a la pestaña solo si no hay captura pendiente.
- **Migración 010 preparada y verificada en PostgreSQL embebido; NO aplicada remotamente.** La revisión automática rechazó la mutación DDL remota por requerir autorización explícita adicional; se solicitó al propietario y sigue pendiente. Comprobación real exclusivamente de lectura: TLS válido, nueve migraciones, tablas/bucket nuevos aún ausentes. Guardas de disponibilidad mantienen cotizaciones/cobros actuales utilizables mientras se activa esta actualización. No afirmar notas/fotos operativas en Supabase todavía.
- Pruebas: **77 correctas en 11 archivos**, lint/typecheck/build correctos. Casos nuevos de proyectos manuales/idempotencia, cobros/saldos, pendientes/RLS/concurrencia y publicación/privacidad de fotos; validador de imágenes rechaza contenido falso, SVG y tamaño excesivo. **42/42** revisiones de composición de componentes reales con datos sintéticos en Chromium/WebKit (375–1440 px, vertical/horizontal y vista corta de 420 px); capturas inspeccionadas. **10/10** comprobaciones de aplicación real sin sesión: menú/Escape, cotizaciones protegidas, fotos 401 sin caché y ausencia de errores. WebKit emulado en Windows; NO Safari real ni iPhone/iPad físicos. Los fixtures de layout aíslan acciones de servidor y no prueban persistencia ni una sesión Auth real.
- Servidor actualizado disponible solo en http://127.0.0.1:3000. Scripts dev:lan/start:lan preparados; la revisión automática también rechazó abrir el servidor a otros dispositivos Wi-Fi sin autorización explícita. Se solicitó por separado; no se abrió la red, no se modificó cortafuegos/router y no se publicaron datos. Teléfono y PC utilizarán la misma cuenta/Supabase; no hay almacenes locales paralelos ni modo offline. Tras autorizar: aplicar 010 con preflight/ensayo y comprobación real, después abrir acceso LAN autorizado y validar una captura/foto desde el dispositivo del propietario.
- Errores corregidos: expectativas de UPDATE rechazado por RLS (devuelve cero filas), tipado de estado de formularios, tamaños táctiles de botones del menú y token siguiente de cobro generado en servidor para no depender de crypto.randomUUID en un navegador servido por HTTP local. Sin cambios al legado, credenciales o datos reales.
- La importación/exportación JSON/CSV del mensaje adjunto anterior quedó pendiente al priorizar la solicitud actual; no se afirma implementada.

## Activación autorizada — 26 de octubre de 2026

- El propietario autorizó explícitamente aplicar la migración 010 y abrir acceso Wi-Fi local. Ambos bloqueos de aprobación anteriores quedaron resueltos.
- Preflight: mismo proyecto, APP_ENV=development, TLS con CA verificada y checksums anteriores intactos. Estado inicial registrado sin credenciales en .local/before-project-workspace.json. Ensayo completo de 010 revertido; luego aplicación definitiva con registro/checksum. **Diez migraciones aplicadas, todas coincidentes**; sin borrar ni sobrescribir datos existentes.
- Verificación remota: ninguna tabla pública sin RLS; bucket project-photos privado, JPEG hasta 2 MB y ocho políticas propias; anon sin ejecución de RPC ni lectura, authenticated sin DELETE físico de fotos. Data API reconoce las nuevas tablas y deniega accesos anónimos con 42501.
- Integración real SQL con identidad de propietario limitada a una transacción: crear proyecto, completar/reabrir pendiente, incremento de versión, anticipo 250.00 sobre total 1,000.00 y saldo 750.00; publicación rechazada al faltar el archivo preparado. Transacción íntegramente revertida y conteos antes/después iguales: no quedaron datos de prueba ni archivos ficticios. Esto no sustituye una subida real mediante Auth desde el teléfono.
- Servidor LAN autorizado iniciado en puerto 3000. Acceso actual: http://192.168.1.60:3000/acceso; PC también puede usar http://127.0.0.1:3000. Misma cuenta y Supabase en ambos dispositivos. No se modificaron cortafuegos/router ni se publicó en Internet. El PC y el proceso deben permanecer encendidos; IP sujeta a DHCP.
- Cuatro verificaciones finales en Chromium/WebKit sobre loopback/IP privada correctas: acceso 200, menú, proyecto protegido, fotos 401 y cero excepciones. Acceso por IP comprobado desde el PC; falta prueba física desde iPhone/iPad, incluyendo subida de cámara/HEIC y posibles restricciones de Wi-Fi/cortafuegos. Se conservan las 77 pruebas, lint/typecheck/build y 42 revisiones responsive ya correctas; sin cambios de código en esta activación.

## Inicio con doble clic — 26 de octubre de 2026

- Acceso directo **ESTUDIO OS** creado y abierto en el escritorio con el isotipo existente. Alternativa portable dentro de la carpeta: `Abrir ESTUDIO OS.vbs`, que ejecuta `scripts/open-estudio.ps1` sin ventana de terminal.
- El lanzador reutiliza el servidor si ya está disponible; en caso contrario prepara la compilación si falta e inicia Next en segundo plano con acceso Wi-Fi previamente autorizado. Comprueba disponibilidad antes de abrir el navegador y avisa si el puerto está ocupado. No configura inicio automático de Windows ni modifica cortafuegos, credenciales o base de datos. Registros operativos en `.local/launcher-*.log`.
- Verificación: sintaxis PowerShell válida; dos ejecuciones con Windows PowerShell y `-NoBrowser` correctas, acceso HTTP 200 y un único proceso escuchando. Destino, argumentos e icono del acceso directo verificados. Sin cambios al código de la aplicación; se mantienen las pruebas anteriores. Para acceder desde el teléfono siguen siendo necesarios el PC encendido y la misma red Wi-Fi.


## Online + Offline — auditoría de Fase A, 26 de octubre de 2026

Solicitud de arquitectura híbrida recibida. Inspección del estado actual y preparación de empaquetado en `.vercelignore`; informe en `docs/ONLINE-OFFLINE-FASE-A.md`. El acceso documentado sigue dependiendo de Next en el PC/LAN; no se localizó publicación pública ni proyecto Vercel vinculado. Variables locales presentes, sin imprimirlas ni modificarlas. No se instaló CLI ni se ejecutaron migraciones, cambios remotos o modificaciones del servidor activo. Pendientes: confirmar hosting/cuenta, validar build y Auth/PDF desplegados, configurar URLs y comprobar una URL pública. Fases B–E no iniciadas. No afirmar modo offline o publicación operativos.

## Preparación Netlify Free y fotografías directas — 26 de octubre de 2026

- Hosting elegido por el propietario: Netlify Free. Node 24 en .nvmrc/netlify.toml; build Next 16.4.2 Webpack, salida .next y adaptador oficial automático OpenNext. PDF/Sharp permanecen Node; fuentes/membrete incluidos. Comandos y lanzador locales conservados; no instalar plugin legacy ni migrar a estático.
- Fotografías: navegador → bucket privado temporal con sesión/RLS, solo metadatos por Server Actions. Servidor descarga una imagen cada vez, comprueba bytes/Sharp, limita 1600 px/2 MiB, elimina metadatos y crea copia canónica privada sin upsert; publicación y limpieza posteriores. Cinco fotos conservadas; reintentos con ID estable, preparación transaccional y descarte controlado, sin duplicar por confirmación perdida.
- Migración **011 preparada y probada únicamente en PostgreSQL PGlite**: bucket temporal/políticas, lectura de copias definitivas aún preparadas solo por su autor, actualización de byte_size limitada a borradores y RPC atómico de preparación. Diez migraciones remotas existentes intactas; 011 NO aplicada. Se necesita autorización, respaldo/ensayo y aplicación antes de usar nuevas fotografías, también en local.
- .gitignore/.gitattributes protegen .env privados, certificados, respaldos, datos locales y legado. check:publish revisa candidatos sin imprimir secretos. Repositorio todavía sin commits/remoto: no se hizo commit, push ni publicación. Guide: docs/NETLIFY-PRIMERA-PUBLICACION.md; la antigua propuesta Vercel de Fase A queda sustituida por esta decisión.
- Verificación: **99 pruebas en 14 archivos**, lint/typecheck/build correctos; regresiones monetarias y ambos PDF conservados. SDK Supabase real con HTTP interceptado comprueba cinco cargas directas de 2 MiB autenticadas; RLS/SQL local cubren otro estudio, lector, autor, anonimato, máximo cinco y protección de publicados. Trazas PDF con fuentes/membrete verificadas.
- **22 comprobaciones** de compilación local nueva, Chromium/WebKit, rutas públicas/protegidas y vista móvil/escritorio sin sesión. No equivalen a Safari físico ni Auth/Storage de producción. Servidor temporal de pruebas en loopback, sin cambios a la instancia anterior.
- Pendiente: autorización/aplicación 011, cuenta/repo privado/Netlify, variables, Auth Site URL, URL de revisión con pruebas reales de login/renovación/fotos/PDF y promoción autorizada. No se desplegó, modificó Auth, guardó datos remotos ni alteró cálculos. No se implementó offline. Free puede pausarse por cuota Netlify o inactividad Supabase.

## Revisión previa de 011 — 26 de octubre de 2026

- Revisión técnica favorable de SHA-256 bac93222d36120cfa36ca9d2b12f2303e55944d068ae8d7ea633ed06e31d5b78, sin modificar SQL ni aplicación. Informe: docs/REVISION_MIGRACION_011.md.
- Supabase consultado solo mediante transacción READ ONLY con TLS: diez checksums coincidentes, 011/nuevos objetos ausentes, RLS activo y función de acceso real coincidente con 010. Sin políticas UPDATE/ALL adicionales ni grants UPDATE en project_photos. Preflight de metadatos guardado en .local/revision-011; no es respaldo de datos. No se ejecutó DDL ni escritura real.
- Diez pruebas específicas nuevas de actualización con datos existentes, aislamiento, ACL, colisiones, rollback y restauración de copia sintética PGlite. Suite completa: 109 pruebas en 15 archivos; lint/typecheck correctos. No se repitió build al no cambiar código/configuración de aplicación.
- BLOQUEO: no se ha verificado respaldo recuperable del Supabase real ni de los binarios Storage. JSON before-* no sirven como backup. Herramientas pg_dump/pg_restore/psql/Supabase CLI/Docker no disponibles en PATH; no se instalaron. Procedimiento de exportación, copia separada de objetos y restore en destino aislado documentado.
- 011 sigue SIN aplicar: requiere respaldo/recuperación comprobados, preflight final y autorización explícita del propietario. No se desplegó Netlify ni se cambió Auth/configuración de producción.


## Respaldo real y recuperación aislada — 26 de octubre de 2026

- Autorizados el respaldo, segunda copia cifrada D:\COPIA_ESTUDIO_OS y recuperación en proyecto nuevo xuzcefjadowmwqdjztxq. Verificado destino vacío y distinto de iswyrxuoqgyuvhzyjnqn antes de escribir. PostgreSQL 17.11 y Vault reales; herramientas portables sin instalación global ni cambio de PATH.
- Snapshot consistente de 66 tablas/341 filas; siete artefactos originales cifrados AES-256-GCM, clave separada, autenticación y hashes comprobados. Se restauró efectivamente desde D:, no desde una exportación sintética. Datos Auth, aplicación y diez migraciones propios preservados; historiales del proveedor archivados y conservados los del destino, sin sobrescribirlos.
- Recuperación satisfactoria: 63 tablas de datos con conteos/hash exactos (94 filas) y tres historiales internos contra baseline; 54 políticas, 127 funciones, 293 relaciones, 5,143 privilegios por columna, roles/membresías/defaults, esquemas/secuencias/extensiones y checksums coincidentes. Además 189 restricciones, 291 columnas, 77 índices, 16 triggers y publicaciones/ACL de base coincidentes.
- Ensayos fallidos por tablas administradas vacías/default privileges se revirtieron. Recuperadas exactamente las ACL propias y las concesiones por columna, retirando permisos extra heredados por objetos nuevos. RLS real de lectura confirma propietario autorizado y bloqueo de usuario ajeno/anónimo. No se inició sesión Auth contra la API del clon.
- Storage: dos buckets privados restaurados e idénticos; cero objetos en origen/snapshot/destino. No había archivos binarios que descargar o probar. Con futuros archivos, añadir respaldo de bytes independiente del dump SQL.
- Certificados recovery-verification.json y final-checks.json en ambas copias. Comparación final de origen READ ONLY a 17:07:45Z: ninguna tabla cambió respecto al snapshot; 011 ausente y diez checksums válidos. No se cambió .env.local, Auth/URLs ni aplicación de producción. No hubo despliegue ni escrituras en origen.
- Procedimiento, limitaciones, incidencias y conservación separada de clave: docs/RESPALDO_Y_RECUPERACION_SUPABASE.md. SQL consolidado y kit de operadores cifrados conservados en ambas copias. El bloqueo por respaldo recuperable queda levantado; **011 sigue SIN aplicar**, pendiente autorización explícita y preflight final. No se repitieron build/lint/suite de aplicación porque no cambió su código; continúan las 109 pruebas anteriores, además de las verificaciones reales de recuperación.


## Reparación de configuración Netlify — 26 de octubre de 2026

- Sitio existente splendorous-gumdrop-81a528, repo existente AleBT23/ESTUDIO_OS/main, commit inicial publicado dd5a9a9. Causa comprobada: cero variables de entorno y por tanto isConfigured() false. Dos variables públicas del Supabase ORIGINAL y APP_ENV=production configuradas/verificadas, contexto production, ámbitos Free incluidos Builds/Functions. Sin credenciales privilegiadas, archivos .env ni conexión de recuperación enviados.
- CLI oficial autenticada y enlazada al ID existente; sin nuevos proyectos/repositorios, plan de pago ni cambios de PATH. Corrección acotada de ESLint para ignorar .local/.netlify. Lint, typecheck sin incremental, build y 109 pruebas correctos.
- Segundo bloqueo: sitio Private de Netlify responde 401 sin su sesión, previo a Next. Confirmación específica solicitada para Make public conservando Supabase/RLS. Nuevo despliegue y login real pendientes al redactar este registro.
- Consulta de Supabase READ ONLY confirma 011 ausente y buckets privados; huellas de tablas de negocio guardadas solo en .local. No se aplicó SQL ni se modificaron datos. Las nuevas fotos siguen bloqueadas por 011 pendiente. Seguimiento: docs/PUBLICACION_NETLIFY.md.

- Cierre de configuración: e9534aa enviado al repositorio existente y deploy 6adf9188c1c5c3c5e2b153e3 publicado. Make public autorizado expresamente y confirmado; la URL ya responde sin sesión Netlify. Next.js Runtime automático, una Edge Function y Function Node.js 24 real verificados. Once pruebas HTTP reales correctas; 52 assets JS con configuración original correcta y sin claves privilegiadas conocidas; 38 entradas Functions sin errores en la ventana consultada. Siete tablas de negocio conservan conteos/hash; las páginas anónimas no contienen IDs reales comprobados.
- **Login real todavía pendiente del propietario**: formulario disponible y petición de entrada enviada; no se ha observado aún sesión Supabase autenticada en el despliegue. Sin afirmar acceso real a datos/PDF o renovación JWT hasta comprobarlo. Fotos siguen pendientes de autorización/aplicación de 011. No se aplicó SQL ni se usó el proyecto de recuperación; sin cambios de datos, Auth/RLS, planes o configuración local existente. Cierre documental con [skip netlify] para evitar consumir otro despliegue.


## Verificación autenticada Netlify — 26 de octubre de 2026

- Propietario confirmó login. Sesión real verificada tras recarga y navegación, Configuración con tres pasos Listo y rol owner. Lectura de dos proyectos, dos clientes, un expediente con notas/cobros y una cotización existente. Sin extracción de cookies, nuevos registros, ediciones ni emisión.
- Se detectó fallo real de vista previa PDF (respuesta genérica del endpoint). Snapshot real pasa validación y render local READ ONLY correcto. Diagnóstico seguro añadido a ambas rutas PDF, con cinco pruebas de no divulgación y regresiones de ambos renderizadores. Corrección remota en investigación. No se aplicó 011 ni se modificó Supabase. Baseline privado actual de las 26 tablas públicas para comprobar ausencia de cambios durante la inspección.

- Causa PDF reproducida con archivos del trace real: PDFKit 0.20.1 usa createRequire y #standard-fonts/Helvetica, que resuelve Helvetica.cjs; Next trazaba solo fuentes .mjs. Paquete aislado reprodujo MODULE_NOT_FOUND; añadir las 15 piezas CJS permitió generar PDF sintético. Inclusión explícita en tracing Next y Functions Netlify, más guard postbuild que verifica ambas rutas y genera un PDF con PDFKit aislado. No se cambiaron cálculos ni datos. Corrección pendiente de verificar en producción.

- Cierre verificado: reparación PDF publicada en 9dec635, deploy 6adfa78c9df8a44f788f5d71 ready/published. Vista previa real autenticada descargada y parseada: siete páginas carta, 505,480 bytes, BORRADOR, Poppins y membrete en cada página. No se emitió ni guardó documento alguno. Mismo endpoint sin sesión devuelve 403 y private/no-store. Sesión sigue activa con tres pasos Listo y owner en Configuración.
- Integridad final: 26/26 tablas públicas con mismos conteos/hash que el baseline autenticado; diez migraciones, 011 ausente, 54 políticas y buckets privados. Sin uso del Supabase de recuperación. Las 117 pruebas, lint, typecheck, build completo y guard postbuild aislado pasaron. No se repitieron después de cambios solo documentales. Servidor de pruebas 3107 detenido, habitual intacto.
- Pendientes: autorización SQL específica para 011/nuevas fotos; prueba física iPhone/iPad y expiración/logout no forzados. PDF independiente sin registro real no probado en producción, con regresiones locales y ambas rutas trazadas comprobadas. Cierre documental con [skip netlify], sin nuevo despliegue.

# Estado de implementación

**4 de noviembre de 2026 · Rama `feature/estudio-os-v2`**

La rama incorpora finanzas por área y origen de fondos, cartera, proyectos, obras, agenda, documentos y equipo. Las últimas secciones registran las pruebas y limitaciones de cada cambio. La conexión Supabase configurada conserva las migraciones 001–010. La versión publicada en Netlify precede a estos cambios.

La aceptación integral sigue pendiente. Faltan los recorridos autenticados de la rama en un Supabase aislado, la conciliación con una copia real actualizada y las funcionalidades abiertas en [TRAZABILIDAD.md](TRAZABILIDAD.md). Los apuntes cronológicos que siguen incluyen el estado conocido en cada fecha.

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
## Refinamiento de cotizaciones — 31 de octubre de 2026

- Ajuste solicitado por el propietario a partir de una cotización de referencia. Poppins 18/12/9/8 pt, tabla clara con líneas finas, descripciones a todo el ancho y totales discretos. Se elimina exclusivamente un primer párrafo de descripción idéntico al nombre; se conservan todas las partidas, importes y datos originales.
- Alcance breve adyacente al presupuesto integrado en la primera página, con los datos de contacto; contenido extenso y orden personalizado conservados. Condiciones y aceptación se reúnen cuando corresponde; firmas de cliente y estudio en paralelo. PDFs ya emitidos se siguen descargando sin regenerarlos.
- Lint y TypeScript sin incremental correctos; 119 pruebas en 17 archivos. Regresión nueva: cotización completa de una página con ambas firmas alineadas, no mutación del snapshot, partidas repetidas válidas conservadas, condiciones largas y secciones reordenadas. Regresión de 45 partidas exige páginas con ocupación útil, evitando continuaciones accidentales con una sola fila.
- Muestras sintéticas, reabiertas y renderizadas con Poppler para revisión visual. Ninguna cotización emitida/guardada ni dato de Supabase modificado durante esta corrección.
- Compilación local intentada dos veces: EPERM al crear subdirectorios del árbol generado .next, incluso tras autorización de escritura. Validación de publicación remota pendiente al preparar este registro. Sin cambios de dependencias, migraciones, credenciales o permisos.
## Identidad gráfica nueva — 31 de octubre de 2026

- Logo y membrete PNG entregados por el propietario integrados sin redibujar, recortar, recolorear ni aplanar su transparencia. Verificada igualdad SHA-256 de las copias activas con los originales recibidos.
- Logo de 2172 × 724 px (3:1) en acceso, inicio, menú y Recursos, con dimensiones proporcionales y textos estáticos actualizados a Alejandro Barajas Arquitectura. Rutas públicas nuevas logo-ab.png/membrete-ab.png para evitar usar copias antiguas en caché. La denominación registrada en Supabase no se cambia automáticamente; las propuestas reales siguen tomando ese nombre de su organización.
- Membrete de 1102 × 1427 px, proporción aproximadamente carta; ambos renderizadores lo ajustan sin deformar. Reserva superior segura de 32 mm, también al previsualizar snapshots de borradores con márgenes anteriores; no se alteran los datos originales. PDFs emitidos permanecen inmutables.
- Logo anterior y membrete anterior respaldados en .local/brand-before-20261031 (privado, no publicable). Se conserva el isotipo antiguo como recurso histórico, pero las vistas activas utilizan el logo nuevo completo proporcionado.
- Verificación: lint, TypeScript sin incremental y las 119 pruebas correctos; cotización completa de una hoja con firmas y minuta independiente renderizadas con Poppler y revisadas visualmente. Se omite la fila de descuento cuando es cero, conservando descuentos reales y todos los cálculos.
- Build local intentado: sigue bloqueado por EPERM del entorno al crear carpetas dentro de .next. No se declara build ni publicación correctos. El propietario eligió expresamente dejar preparado y publicar después; no se ejecutó publicación, no se modificó Supabase ni se cambiaron permisos del navegador.
- Revisión responsive adicional completada con los navegadores instalados: 42/42 comprobaciones de componentes reales en Chromium/WebKit, de 375 a 1440 px y vista corta. No equivale a una sesión remota ni prueba física en dispositivos.

## Activación local — 31 de octubre de 2026
- Compilación productiva nueva completada correctamente en .next-local mediante ESTUDIO_LOCAL_BUILD=1. El build normal de Netlify conserva .next. Carpeta local excluida de Git y ESLint; TypeScript incluye los tipos generados.
- Acceso directo ESTUDIO OS.lnk verificado: ejecuta el VBS existente y scripts/open-estudio.ps1. El lanzador utiliza ahora http://localhost:3001 y la compilación local nueva; conserva arranque oculto, reutilización de instancia y acceso LAN. Puerto 3000 responde con instancia previa, no se detuvo un proceso de identidad no verificable.
- Comprobación HTTP real: /acceso y /recursos 200 con logo-ab; logo y membrete 200 con SHA-256 idéntico a los recursos nuevos. Repetición del lanzador -NoBrowser correcta sobre el servidor activo. Build, lint y TypeScript correctos; se mantienen las 119 pruebas y 42 verificaciones del incremento previo.
- Servidor de revisión activo en 3001. Los procesos iniciados por Start-Process desde el entorno restringido no persistieron al terminar la llamada; la comprobación final usa una sesión Node persistente. El acceso directo mantiene el mecanismo de inicio normal bajo la sesión Windows del propietario.
- No hubo despliegue web ni cambios de Supabase. Ejecución local sigue necesitando Internet para autenticación y datos de Supabase.

## ESTUDIO OS 2.0 · 3 de noviembre de 2026

Rama local feature/estudio-os-v2. Inicio autenticado con conteos exactos de proyectos activos y cotizaciones enviadas por organización, acciones comerciales según rol y pendientes existentes. Los errores de consulta se distinguen de un conteo cero. La última verificación documentada de producción sitúa la migración 011 pendiente. Typecheck, ESLint, 119 pruebas Vitest y compilación productiva con verificación de PDF correctos. Pendiente validar el nuevo inicio con sesión en preview.
El centro muestra los cinco proyectos con mayor saldo por cobrar y distingue cobros efectivos de saldos. Reutiliza project_financial_summary (010) y la política financiera existente. Lint, typecheck, build, empaquetado y 119 pruebas correctos. Playwright: cuatro casos correctos en Chromium, incluido móvil, y uno exclusivo de instalaciones sin conexión omitido al cargar la configuración local del runner. Pendiente prueba autenticada del panel.

Continuación: extender obligaciones y liquidaciones en un entorno de desarrollo aislado, vinculando los cobros históricos antes de agregar obras y servicios. Probar pagos parciales, reversos, reintentos, fondos de cliente y aislamiento entre organizaciones. Quedan la agenda, filtros e indicadores restantes, rediseño de navegación, módulos del roadmap y preview.
### Operaciones financieras por área
Migración aditiva 012 probada en PGlite. En Administración → Operaciones se crean obras y acuerdos independientes, con cliente, proyecto u obra opcionales, proveedor y compromisos en MXN. El detalle registra cobros, pagos parciales y anticipos, con límites transaccionales por sentido. Los fondos administrados excluyen margen. Los planes históricos conservan su flujo de cobro original; el acuerdo nuevo se usa exclusivamente para importes adicionales. Typecheck, lint y 120 pruebas correctas. Pendientes preview autenticada, prueba concurrente con conexiones independientes, reversos en el nuevo registro y respaldo verificado antes de migrar producción.

### Agenda y navegación
La agenda consulta los pendientes existentes por organización y zona horaria, con vistas de hoy, siete días, vencidos, lista, completados y fecha elegida. Reutiliza edición, reprogramación, completar y reabrir con control de versión. Barra lateral contraíble en escritorio con preferencia persistente y accesos autenticados según rol. Typecheck, lint, 120 pruebas, build y empaquetado correctos. Chromium: cinco casos correctos y uno exclusivo de instalaciones sin credenciales omitido. Pendientes recordatorios independientes, recurrencias y responsables.

### Indicadores financieros
Migración 013 y resumen en Inicio: cobrado, pagado, cartera, cuentas por pagar, flujo y margen previsto por área y custodia. Los planes históricos aparecen por separado con su alcance original. Totales agregados en SQL y transferidos como texto entero para preservar precisión. Comprobados los totales y la exclusión del margen en fondos del cliente; 120 pruebas, typecheck, lint y compilación correctos.

### Expedientes de obra y exportación
La ruta Obras lista expedientes y presenta saldos por origen del dinero, con exportación CSV privada por obra. La migración 014 agrega exclusivamente un índice y una vista con permisos del invocador. Pruebas con dos obras, dos custodias y otro usuario verifican la separación. Se prueba exportación de números mayores que el rango entero seguro de JavaScript. Typecheck, lint, 122 pruebas y build correctos. Los capítulos, partidas, estimaciones y comprobantes de obra siguen pendientes.

### Reversos del nuevo registro financiero
Migración 015 probada localmente. Cada movimiento se puede revertir una vez indicando el motivo; PostgreSQL conserva importe, actor y fecha del reverso, recalcula saldos y permite registrar la corrección. No se conceden permisos para editar importes ni borrar movimientos. Pruebas de regresión verifican reverso único, aislamiento y liberación del saldo. Typecheck, ESLint, 123 pruebas y build correctos. Las migraciones 012–015 están pendientes de validación sobre una copia Supabase aislada y respaldo.

### Presupuesto base por obra
Migración 016. El expediente permite capturar capítulos y partidas con cantidad decimal, unidad y precio unitario. PostgreSQL redondea por partida y totaliza el presupuesto completo, incluso con paginación. La presupuestación no registra ningún movimiento efectivo. Comprobados redondeo, permisos, aislamiento del libro de movimientos, 124 pruebas, lint, tipos y build.

Verificación final sobre el build con presupuesto de obra: Playwright Chromium, cinco casos correctos y uno omitido por requerir instalación sin credenciales. La prueba autenticada en un Supabase de desarrollo, la ejecución con conexiones concurrentes y la verificación de respaldo siguen pendientes. Próximo incremento financiero: registro de facturas vinculado al acuerdo, con separación entre facturado y cobrado. En obra siguen estimaciones, comprobantes y padrón de proveedores; en agenda, responsables, categorías y recurrencias. Mantener las migraciones de producción pendientes.

### Registro de facturas emitidas
Migración 017. Desde el detalle de un acuerdo se registran folio, fecha e importe de las facturas emitidas y se consulta el total facturado. El cobro y la cartera se mantienen independientes. El folio se protege contra duplicados por organización. Validado con PostgreSQL aislado, 125 pruebas, TypeScript y ESLint. Pendiente preview autenticada.

### Padrón comercial de proveedores
Migración 018. Administración → Operaciones permite abrir el padrón, buscar proveedores y subcontratistas y asociarlos a nuevos acuerdos. Se conserva el nombre histórico del proveedor del acuerdo. La prueba PostgreSQL comprueba la asociación y el rechazo de una referencia cruzada entre estudios. TypeScript, ESLint y 126 pruebas correctos.

### Búsqueda y tema de la aplicación
Búsqueda por nombre en clientes, proyectos, cotizaciones, documentos, obras y acuerdos con consultas por organización y por permiso; acceso desde la cabecera y Ctrl/Cmd+K. Tema claro/oscuro compartido, con preferencia persistida y aplicada desde el render inicial. TypeScript, ESLint, 126 pruebas, build y verificación PDF correctos. Chromium: seis pruebas correctas y una de instalación sin credenciales omitida; verificadas persistencia del tema, navegación móvil y protección de las rutas nuevas. Falta prueba autenticada de los resultados de búsqueda.

### Comunicaciones con clientes y bitácora de obra
Migración 019. Los expedientes incluyen entradas fechadas, historial paginado y autor registrado. Los clientes archivados conservan el historial en modo lectura. Se prueban las categorías permitidas para cada expediente y el aislamiento entre organizaciones. TypeScript, ESLint, 127 pruebas y compilación con empaquetado PDF correctos.

### Entregables y revisiones de proyecto
Migración 020. Desde cada proyecto se registran etapa, entregable, responsable y fecha. Los colaboradores pueden presentar revisiones con notas y enlace HTTPS. Administración solicita cambios o aprueba sobre una revisión enviada. La aprobación cierra el historial; los reintentos con una versión obsoleta se rechazan en PostgreSQL. Se probaron las transiciones, lectura por rol y aislamiento. TypeScript, lint, 128 pruebas y compilación con guard PDF correctos. Continúan pendientes las plantillas editables de etapas y la validación autenticada en preview.

### Calendario mensual con vencimientos derivados
Migración 021. Agenda → Calendario permite navegar meses y consultar pendientes, entregas abiertas y cobros pendientes por día, según los permisos aplicables. Los cobros parciales mantienen el recordatorio; al liquidar el plan desaparece de la agenda. Validación local: 129 pruebas, TypeScript, ESLint, build y guard PDF correctos; seis pruebas Playwright aprobadas y una exclusiva de instalación sin credenciales omitida; 42/42 comprobaciones de layout móvil. La validación autenticada en Supabase aislado y concurrencia multiconexión permanece abierta. Siguiente trabajo ejecutable: estimaciones y recursos consumidos por partida, recurrencias y adjuntos privados. Continúan en alcance contratos, portal, automatizaciones y requisitos del roadmap aún abiertos.

### Estimaciones parciales por partida
Migración 022. Cada partida enlaza su historial de mediciones, cantidad ejecutada y pendiente. PostgreSQL limita el acumulado mediante actualización condicional y calcula importes por diferencia entre acumulados redondeados; al terminar se concilia con el presupuesto. La estimación no genera cobros ni pagos. Probados reintento con conflicto, límite de cantidad, centavos fraccionarios y aislamiento. TypeScript, lint, 130 pruebas y build con guard PDF correctos. Pendiente prueba con dos conexiones en PostgreSQL independiente.

### Consumos de materiales, mano de obra y equipo
Migración 023. Cada partida incluye un registro físico de recursos por fecha, unidad, cantidad y proveedor opcional. El historial se filtra por categoría. Los consumos no incrementan automáticamente la estimación ni registran cargos. Se verificó que PostgreSQL rechaza referencias a partidas de otra obra y excluye otras organizaciones. TypeScript, lint, 131 pruebas y compilación con guard PDF correctos. Siguiente bloque: recurrencias, prioridades y responsables de agenda y comprobantes privados.

### Recurrencia y asignación de pendientes
Migración 024. Los pendientes del expediente admiten prioridad, responsable del estudio y repetición diaria, semanal o quincenal. Al completar se crea la ocurrencia siguiente respecto a la fecha programada, en la misma transacción. Reabrir y completar nuevamente conserva una sola sucesora. La agenda incorpora vistas de prioridad alta y asignados a mí. Se probaron cambio de año, restricciones de fecha y membresía y ausencia de duplicados. TypeScript, ESLint, 132 pruebas y build con empaquetado PDF correctos.

### Comprobantes privados de movimientos
Migración 025 agrega metadatos y bucket privado finance-receipts. El historial de los acuerdos permite adjuntar y descargar PDF/JPEG/PNG de hasta 2 MiB por movimiento. La descarga verifica SHA-256, tamaño y firma. Una carga incompleta no aparece en la lista de archivos disponibles y el mismo archivo se puede reintentar. Probados aislamiento, restricción a roles financieros, inmutabilidad y endpoint sin sesión. TypeScript, ESLint, 134 pruebas, build, seis casos Chromium y 42 comprobaciones responsive correctos. Una prueba exclusiva para instalación sin credenciales se omitió. Falta ensayo autenticado de transporte contra Storage aislado.

### Concurrencia PostgreSQL con procesos independientes
Se aplicaron las 25 migraciones en un clúster PostgreSQL 18.6 desechable en loopback, con el esquema mínimo de Auth y Storage usado por las pruebas. Dos conexiones autenticadas compitieron por el mismo saldo y después por la misma cantidad presupuestada. El verificador observó la espera de bloqueo en pg_stat_activity antes de liberar la primera transacción, comprobó el rechazo de la segunda y concilió los acumulados. Dos corridas completas correctas; 134 pruebas Vitest, TypeScript y ESLint correctos. Comando reproducible: npm run db:concurrency. Aún falta Supabase aislado para el transporte HTTP de Auth/Storage y validación de formularios autenticados. El primer ensayo de arranque dejó un directorio de datos sintéticos detenido y excluido de Git en .local/concurrency/run-6w5qdT; las corridas posteriores limpiaron su clúster.

### Registro de contratos firmados
Migración 026. Comercial → Contratos reúne folio, fecha, servicios contratados y enlace opcional al documento firmado. Los expedientes de cliente y proyecto abren el registro filtrado. El proyecto enlaza a su cotización de origen. Se probó que el proyecto debe pertenecer al mismo cliente, el folio no puede repetirse y el registro no genera nuevos cobros. TypeScript, ESLint, 135 pruebas, build productivo y aplicación de las 26 migraciones en PostgreSQL 18.6 con prueba multiconexión correctos. Pendiente validación autenticada de las relaciones PostgREST en preview.

### Portal de clientes y publicación explícita
Migración 027. La ruta /portal ofrece registro y acceso mediante Supabase Auth. El administrador vincula el identificador de cuenta al expediente del cliente. Desde un entregable aprobado puede publicar un enlace autorizado y retirarlo. La vista del cliente solo incluye entregas visibles compartidas con su cuenta; la revocación de acceso se comprueba en cada lectura. Los permisos del archivo externo siguen dependiendo de su proveedor. Se probó aislamiento de notas internas y lectura antes/después de habilitar, retirar y revocar. TypeScript, ESLint, 136 pruebas, 27 migraciones en PostgreSQL local y build correctos. Playwright: siete casos aprobados y uno exclusivo de instalación sin credenciales omitido; 42 comprobaciones responsive correctas. Pendiente E2E autenticado con dos cuentas de prueba en Supabase aislado. Próximos bloques del roadmap: tiempo por paquete, honorarios de colaboradores y rentabilidad real por línea; plantillas reutilizables y gestión de cambios de alcance.

### Tiempo por proyecto, paquete y tarea
Migración 028. Cada expediente permite registrar la actividad propia con fecha y minutos; paquete y tarea son opcionales y deben pertenecer al proyecto. Los colaboradores consultan sus registros y administración los del equipo. La corrección comprueba versión y conserva valores anteriores y actor en time_corrections. Los administradores pueden consultar el directorio de membresías de su organización para asignar responsables. TypeScript, lint, 137 pruebas y 28 migraciones en PostgreSQL multiconexión correctos.

### Honorarios y distribución por paquete
Migración 029. El expediente permite acordar honorarios fijos o un porcentaje del neto contratado de un paquete con un miembro del equipo. Cada regla crea atómicamente un solo acuerdo de costo y reutiliza su historial de pagos, comprobantes, reversos y saldo. El reparto porcentual acumulado no excede el 100 % y el redondeo concilia hasta el último centavo. Verificados pago parcial, reintento, aislamiento y límite concurrente en PostgreSQL 18.6 con dos escritores. TypeScript, lint, 138 pruebas y build con guard PDF correctos.

### Flujo y productividad por línea y periodo
Migración 030. Administración → Reportes calcula cobrado, pagado, flujo, minutos y flujo por hora, con filtros por fechas, cliente, proyecto, obra, paquete y línea. El CSV privado usa la misma función SQL. Los cobros históricos de planes sin paquete aparecen en «Sin línea atribuida»; los fondos administrados permanecen separados. Se comprobó la conciliación de efectivo y horas, el filtrado por periodo, el rechazo a roles no financieros y la precisión y seguridad del CSV. TypeScript, ESLint, 140 pruebas, 30 migraciones con prueba multiconexión y build con empaquetado PDF correctos; siete casos Playwright aprobados, uno omitido por configuración y 42 verificaciones responsive. Falta preview autenticada con Supabase. Siguiente bloque: solicitudes de cambio y extras acordados vinculados al alcance original; plantillas editables y recursos de marketing.

### Solicitudes de cambio y cotizaciones complementarias
Migración 031. El expediente registra el alcance solicitado y su impacto en días. Administración vincula un borrador del mismo cliente, lo emite y registra la aceptación por el flujo de cotizaciones existente. Al aprobar, los paquetes adicionales y las obligaciones se vinculan a la solicitud y al proyecto original en una transacción. Se conservan el alcance y los cobros anteriores. Se probó la aceptación con dos líneas, reintento, conciliación con la cotización, ausencia de cobro automático y aislamiento. TypeScript, ESLint, 141 pruebas, 31 migraciones en PostgreSQL local y build con verificación PDF correctos.

### Plantillas documentales versionadas
Migración 032 pendiente de producción. Recursos permite guardar un documento como plantilla, publicar revisiones y generar documentos independientes desde versiones anteriores. Se conserva el contenido sin copiar la asociación al cliente o proyecto. Las 142 pruebas automatizadas pasaron localmente.
El editor inicializado desde plantilla se incorporó a la prueba de composición. Se corrigieron siete botones de inserción demasiado bajos en pantallas táctiles. Chromium y WebKit aprobaron 56 combinaciones de vista y tamaño con datos locales.

### Calendario editorial y portafolio
Migración 033 pendiente de producción. Comercial → Marketing permite registrar ideas sin fecha, programar y publicar por canal, capturar enlaces y resultados, y filtrar el portafolio asociado a proyectos y oportunidades. Acceso de propietario y administrador, aislamiento por organización y control de versión. Se verificaron TypeScript, ESLint, 143 pruebas, las 33 migraciones en PostgreSQL local y el build con empaquetado PDF. Pendiente la prueba autenticada en preview.

### Procedimientos reutilizables
Recursos → Procedimientos permite a administración definir pasos ordenados y al equipo iniciar listas independientes con proyecto opcional. Cada ejecución muestra el avance y permite completar o reabrir pasos. Migración 034 verificada en PostgreSQL local, con aislamiento y permisos por rol. Pasaron 144 pruebas, TypeScript, lint y compilación. Pendientes la preview autenticada y la biblioteca técnica/BIM.

### Biblioteca técnica y BIM
Recursos → Biblioteca técnica permite publicar revisiones con etiquetas, descripción, vínculo y un archivo privado de hasta 2 MiB. Los modelos de mayor tamaño se referencian por vínculo. Se conserva cada revisión junto con su adjunto en la misma transacción. Búsqueda paginada sobre la versión vigente y descarga por revisión con autorización del estudio. 145 pruebas, lint, TypeScript, build y 35 migraciones en PostgreSQL local correctos. La prueba de extremo a extremo con Auth y la migración de producción siguen pendientes.

### Fases por línea o servicio
El expediente permite aplicar una plantilla, avanzar y reabrir fases. Administración puede modificar los nombres y etapas para futuros planes. Cada plan conserva una copia al aplicarse. Los estudios reciben recorridos iniciales distintos para arquitectura y visualización. Se verificaron aislamiento, límites y preservación de la versión aplicada, con 146 pruebas, TypeScript, lint y 36 migraciones locales. La migración 036 sigue pendiente de producción.

### Vencimientos comerciales y editoriales en la agenda
La agenda incorpora seguimientos activos del pipeline y publicaciones programadas. Las vistas Hoy, Semana, Fecha, Vencidos y Lista muestran además los cobros pendientes y entregas desde sus registros originales. Reprogramar, cerrar la oportunidad o publicar el contenido actualiza el calendario y los conteos diarios. Los permisos comerciales se conservan. 147 pruebas, TypeScript, lint, build y 37 migraciones locales verificados. Migración 037 pendiente de producción y recorrido autenticado pendiente.

### Notificaciones personales de agenda
Inicio muestra el número de avisos sin leer y Agenda abre la bandeja individual. Los vencimientos de hoy y atrasados reutilizan los permisos de sus eventos y la zona horaria del estudio. Marcar leído o sin leer no cambia la tarea ni el cobro. Cambiar a otra fecha pendiente produce un aviso para esa fecha. Verificados aislamiento entre usuarios, reprogramación y exclusión de eventos futuros. Pasaron 148 pruebas, lint, TypeScript, build y 38 migraciones locales. La migración 038 y el recorrido autenticado en preview siguen pendientes.

### Favoritos personales y búsqueda ampliada
Inicio → Mis favoritos reúne registros guardados desde la búsqueda global. Se suman oportunidades, publicaciones y recursos técnicos. Cada usuario administra su lista, con paginación y filtro por nombre. Los resultados usan el registro vigente y sus permisos. Se probaron renombrado, archivo, aislamiento personal y entre organizaciones. 149 pruebas, TypeScript, ESLint, build y 39 migraciones locales correctos. La migración 039 y la validación autenticada en preview siguen pendientes.

### Actividad reciente en Inicio
La cronología paginada enlaza cambios de estado de cotizaciones, revisiones de entregables, cobros de proyecto, movimientos y reversos financieros y versiones de biblioteca. La fecha corresponde al registro del evento y se presenta en la zona horaria del estudio. Se verificaron el movimiento original, su reverso y su aislamiento por rol y organización. Pasaron 150 pruebas, TypeScript, lint, build y 40 migraciones en PostgreSQL local. Pendientes la preview autenticada y la migración 040 en producción.

### Crear registro desde la navegación
El menú del estudio abre las acciones rápidas de Inicio según el rol. Administración puede abrir directamente los formularios comerciales, de proyectos, obras y acuerdos. Los colaboradores pueden elegir un proyecto por nombre y abrir la captura de pendientes o visitas. Los lectores no reciben acciones de escritura. Pasaron 151 pruebas, TypeScript, ESLint y compilación con verificación PDF. Bloque sin migración. Falta recorrer los enlaces con sesiones autenticadas en preview.

### Cartera y flujo consolidados en Inicio
Los indicadores muestran la cartera completa del despacho, costos pendientes y flujo cobrado menos pagado. Incluyen planes de proyecto y acuerdos propios; los fondos recibidos y aplicados por cuenta del cliente aparecen en un saldo independiente. El listado de cinco proyectos es solo un desglose. Prueba de conciliación en centavos con valores superiores al rango entero seguro de JavaScript. Pasaron 152 pruebas, TypeScript, lint y compilación. Este bloque no requiere migración. Falta validación autenticada de la presentación.

### Flujo de Inicio por periodo y línea
Inicio consulta la misma función financiera que Administración → Reportes. La tabla del periodo reúne los cobros y pagos efectivos por titular de fondos, con sumas en centavos. Permite guardar fechas y línea por usuario y estudio en el navegador por 90 días y abrir el detalle con los mismos filtros. La cartera acumulada se presenta aparte. Pasaron 153 pruebas, TypeScript, lint y build. Bloque sin migraciones nuevas. Falta validación autenticada de la persistencia en navegador.

### Pendientes vencidos y entregas próximas en Inicio
Dos indicadores con conteo exacto abren vistas específicas de Agenda. Los pendientes completados y las entregas aprobadas se excluyen. Los siete días incluyen hoy y los seis siguientes según la zona horaria del estudio. Se verificaron límites de calendario, cambio de año y año bisiesto. Pasaron 154 pruebas, TypeScript, lint y compilación. Sin migración nueva. Falta contrastar conteos y listados con una sesión autenticada en preview.

### Subtareas de proyecto
Cada pendiente del expediente admite pasos individuales con avance visible. El cierre desde Agenda, Inicio y el expediente exige que todos estén completos. Las recurrencias comienzan con una copia abierta de los pasos. Se verificaron cierre, reapertura protegida, recurrencia y aislamiento entre estudios. Pasaron 155 pruebas, TypeScript, ESLint, build y 41 migraciones en PostgreSQL local. Pendientes las dependencias entre tareas, la preview autenticada y la migración de producción.

### Dependencias simples entre tareas
Desde el expediente se puede elegir, sustituir o quitar una tarea previa del mismo proyecto. PostgreSQL rechaza ciclos y cierres fuera de orden, incluso al completar desde Agenda o Inicio. Para reabrir un requisito finalizado primero se reabren las tareas terminadas que dependan de él. Se verificaron cadenas, ciclos, cruce de proyectos y liberación del vínculo. Pasaron 156 pruebas, TypeScript, lint, build y 42 migraciones locales. Pendientes el tablero Kanban y la validación autenticada en preview.

### Tablero de tareas
Agenda → Tablero Kanban presenta pendientes, tareas en curso y completadas con paginación independiente. Los cambios de columna actualizan la misma tarea, sujetos a versión, permisos, subtareas, dependencias y reglas de recurrencia. Se probó el estado inicial, avance, cierre desde otra vista, escritura obsoleta y aislamiento. Pasaron 157 pruebas, TypeScript, lint, build y 43 migraciones locales. Pendientes la preview autenticada y la migración de producción.

### Historial de correcciones de tiempo
El expediente expone las versiones previas del registro de horas con fecha, minutos, actividad, tarea y paquete, además de quién corrigió y cuándo. El formulario conserva una asociación anterior aunque ya no aparezca en su selector. Los permisos proceden de las políticas de tiempo existentes. Pasaron 158 pruebas, TypeScript, lint y compilación. Sin migración nueva. Pendiente validación autenticada en preview.

### Estimación y ejecución en el expediente
El proyecto reúne las cotizaciones aceptadas y extras aprobados una sola vez, con honorarios netos sin IVA, costos externos previstos, utilidad y margen previstos antes de horas internas, horas estimadas y tarifa por hora estimada. Se contrastan con cobros, pagos efectivos propios y minutos registrados del reporte financiero. Probado con dos propuestas de dos paquetes y control de lectura. Pasaron 159 pruebas, TypeScript, ESLint, build y 44 migraciones en PostgreSQL local. Migración 044 pendiente de producción y recorrido autenticado pendiente.

### Atribución del flujo por obra
Si un acuerdo identifica únicamente la obra, el reporte usa el proyecto asociado a ella y resuelve el cliente desde los vínculos existentes. Las asociaciones explícitas conservan prioridad. La corrección beneficia al expediente, al reporte y al CSV, sin reescribir acuerdos. Se probó la conciliación por obra frente a obra + proyecto + cliente con fondos propios y administrados separados. Pasaron 160 pruebas, TypeScript, lint y 45 migraciones en PostgreSQL local. La migración 045 queda pendiente de producción.

### Integridad de las asociaciones financieras
Obras y acuerdos nuevos comprueban la relación cliente–proyecto. Un acuerdo con obra rechaza un proyecto distinto incluso si ambos tienen el mismo cliente, y contrasta el cliente explícito o heredado. Se mantienen válidos los registros independientes y los vínculos parciales. Las claves foráneas se añaden NOT VALID para no exigir correcciones históricas al instalar la migración. Antes de producción deben auditarse los vínculos históricos y verificarse los respaldos. 161 pruebas, TypeScript, ESLint y 46 migraciones en PostgreSQL local correctos.

### Auditoría previa a la migración 046
Ejecutar scripts/sql/audit-finance-associations.sql sobre una copia restaurada con acceso de lectura completo a projects, works y finance_cases. Cada fila identifica una discrepancia, el vínculo seleccionado y el esperado. Un resultado vacío acredita solo estas comprobaciones. La prueba local en transacción de solo lectura detectó cuatro discrepancias simuladas y respetó los vínculos opcionales válidos. Pasaron 162 pruebas, TypeScript y ESLint. Sigue pendiente ejecutar la consulta sobre un respaldo real restaurado.

### Acceso sin sesión en los módulos recientes
Playwright comprobó en Chromium que Agenda Kanban, notificaciones, marketing, biblioteca, procedimientos, plantillas e historial de tiempo redirigen a acceso sin sesión. Las descargas de biblioteca y reporte de obra devolvieron 403. Compilación y verificación PDF aprobadas. Siete recorridos pasaron y se omitió el de instalación sin credenciales porque Supabase está configurado. Aún falta la prueba autenticada en preview.

### Directorio de proyectos paginado
El directorio consulta 30 expedientes por página con total exacto y orden estable. Conserva el nombre buscado, el estado y el destino de captura de pendientes o visitas al cambiar de página. Inicio → Proyectos activos abre la selección correspondiente al indicador. La prueba del componente verificó el rango 211–240 y la navegación conservando filtros con datos simulados. Pasaron 163 pruebas, TypeScript y ESLint. Pendiente recorrido autenticado.

### Consulta de cotizaciones por estado
Inicio → Cotizaciones enviadas abre las propuestas enviadas del mismo estudio. En Comercial se puede combinar estado con búsqueda por nombre y conservar ambos al paginar. Orden estable por actualización e identificador. La prueba del componente verificó el filtro, rango y enlace de página con datos simulados. Pasaron 164 pruebas, TypeScript y ESLint. Pendiente validación autenticada en preview.

### Precisión del resumen financiero por proyecto
Inicio y el expediente solicitan como texto los totales en centavos de project_financial_summary y los formatean con BigInt. La clasificación de saldos sigue usando la columna numérica en PostgreSQL. La regresión de formato verifica un total superior al rango entero seguro de JavaScript. Pasaron 164 pruebas, TypeScript, ESLint y compilación. Pendiente comprobar las consultas PostgREST con una sesión autenticada en preview.

### Cobrado por hora en reportes
Administración → Reportes y el CSV incluyen cobros propios efectivos por hora registrada junto al flujo por hora después de pagos. Ambos usan el mismo filtro y cálculo en centavos. La tasa queda vacía para fondos administrados y periodos sin horas. Pasaron 165 pruebas, TypeScript y ESLint. Pendiente validar la presentación autenticada.

### Exportación de avance de obra
Obras permite descargar por separado el balance financiero y el avance por partida. La vista 047 calcula cantidades e importes pendientes a partir de las estimaciones acumuladas. El CSV conserva los centavos, escapa texto libre y recorre el presupuesto por páginas. Pasaron 166 pruebas, TypeScript, ESLint y concurrencia en PostgreSQL local con 47 migraciones. Falta validar la descarga autenticada en preview y restaurar un respaldo antes de migrar producción.

### Consulta del avance en el presupuesto
El presupuesto y el detalle de partida muestran el valor acumulado estimado y el importe pendiente con el mismo cálculo del CSV. El máximo del formulario proviene de la cantidad pendiente en SQL. Pasaron 166 pruebas, lint, compilación con verificación PDF y TypeScript. Playwright pasó siete recorridos y omitió el de instalación sin credenciales. Pendiente probar la captura autenticada.

### Notificaciones por tipo
La bandeja admite filtros por cobro pendiente, entrega, tarea, seguimiento y publicación. Aplica el filtro en Supabase antes de paginar y conserva el tipo entre leídos y sin leer. 167 pruebas, TypeScript y ESLint correctos. Pendiente recorrido autenticado.

### Consulta de acuerdos con saldo
Operaciones permite combinar área, origen de fondos y saldo por cobrar o pagar. Los filtros se aplican sobre la vista de saldos y permanecen al paginar. Pasaron 168 pruebas, TypeScript, ESLint, compilación y siete recorridos Playwright sin sesión. Falta el recorrido autenticado en preview.

### Vencimientos financieros en Agenda
Los acuerdos admiten fechas opcionales e independientes de cobro y pago. El expediente permite reprogramarlas o retirarlas, comprobando los valores anteriores para detectar ediciones concurrentes. Agenda, calendario y notificaciones consultan los saldos efectivos y enlazan al acuerdo, incluso sin proyecto. Prueba SQL de abono parcial, liquidación, reverso, retiro de fecha y aislamiento por rol y organización. Pasaron 169 pruebas, TypeScript, ESLint, build, verificación de PDF y concurrencia con 48 migraciones en PostgreSQL local. Playwright pasó siete recorridos y omitió el de instalación sin credenciales. Migraciones 047 y 048 pendientes en producción. Siguiente validación de integración: recorrer con sesión aislada la creación de un acuerdo, reprogramación, pago, reverso y descarga de avance de obra; respaldar y verificar restauración antes de publicar.

### Recordatorios personales sin proyecto
Agenda → Mis recordatorios permite crear, reprogramar y completar pendientes privados. Un intervalo de 1 a 365 días crea una nueva ocurrencia desde la fecha programada al completar la anterior. Calendario, avisos y conteos reutilizan la misma fuente con RLS. Se probaron aislamiento, versiones obsoletas, reprogramación y cierre simultáneo en dos conexiones reales. Pasaron 170 pruebas, TypeScript, ESLint, build, empaquetado PDF, siete recorridos Playwright y concurrencia en PostgreSQL con 49 migraciones. Un recorrido exclusivo de instalaciones sin credenciales se omitió. Migración 049 pendiente de producción; falta recorrido autenticado en preview.

### Acuerdos en el expediente del cliente
Comercial → Cliente muestra los acuerdos propios y administrados con sus saldos por cobrar y por pagar. Incluye acuerdos vinculados indirectamente por proyecto u obra y enlaza a su historial y al reporte filtrado. Se verificaron atribución y permisos. Pasaron 171 pruebas, TypeScript, ESLint, build, Playwright (7 aprobadas y 1 omitida) y concurrencia PostgreSQL con 50 migraciones. Pendiente validar en preview y producción.

### Archivo recuperable de documentos
En Recursos → Documentos, administración puede archivar un documento, buscarlo en Archivados y restaurarlo. La operación comprueba la versión vigente y registra actor y cambio en la auditoría existente. La prueba SQL verificó permisos, edición obsoleta, recuperación del texto y conservación del registro emitido con su snapshot y ruta privada. Biblioteca y Procedimientos ya enlazan a sus módulos desde Documentos. Pasaron 172 pruebas, TypeScript, ESLint, build y empaquetado PDF; 7 recorridos Playwright pasaron y 1 se omitió. PostgreSQL local aplicó 51 migraciones. Pendiente recorrido autenticado con descarga desde Storage en preview y restauración de un respaldo real antes de migrar producción.

### Ensayo reproducible de restauración de ESTUDIO OS 2.0
Ejecutar npm.cmd run db:restore-test con los binarios locales PostgreSQL 17.11 incluyendo pg_dump y pg_restore. El ensayo crea un clúster temporal en loopback, aplica las 51 migraciones, genera datos sintéticos, restaura un archivo de formato custom en una segunda base vacía y compara saldos, snapshot documental, ruta privada, estado archivado y aislamiento. Ejecuta también la auditoría 046 en transacción de solo lectura. Pasaron la restauración, cuatro carreras entre escritores, 172 pruebas, TypeScript y ESLint. El ensayo cubre metadatos SQL de Storage; el binario y la descarga requieren validación aparte. El respaldo real documentado del 26 de octubre cubre hasta 010. Antes de producción queda verificar vigencia y compatibilidad de la copia real con las migraciones posteriores.

### Reprogramación y parcialidades de proyectos
Desde Administración y el expediente se puede mover el vencimiento o separar una parte pendiente en otra fecha. La transacción conserva el importe contratado, los pagos, el proyecto y el vínculo con el cambio de alcance. El historial registra importe y fechas; Agenda usa las obligaciones actualizadas. Los reintentos se deduplican y un cobro simultáneo invalida el saldo leído. Pasaron 173 pruebas, TypeScript, ESLint, build, empaquetado PDF y 7 recorridos Playwright (1 omitido). PostgreSQL 18 comprobó la carrera y PostgreSQL 17 restauró la base sintética con 52 migraciones. Migración 052 y flujo autenticado en preview pendientes de producción y validación, respectivamente.

### Recibos de movimientos en PDF
Administración, el proyecto y el acuerdo permiten descargar el recibo de un movimiento registrado. Muestra el importe exacto, los fondos, la referencia, el cliente o proveedor cuando están vinculados y el estado vigente, incluido el motivo de reverso. El archivo se genera al consultar el movimiento. Se verificó el texto reabriendo el PDF, el aislamiento entre organizaciones/roles y la distinción de origen con un mismo UUID en los dos libros. Pasaron 175 pruebas, TypeScript, ESLint, compilación con las tres rutas de PDF y 7 recorridos Playwright (1 omitido). Se restauró la base sintética con 53 migraciones. Falta descargar con sesión autorizada en preview. Migración 053 pendiente de producción.

### Estado de cuenta del proveedor y subcontratista
Desde el padrón se abre el contacto, sus compromisos, pagos efectivos y saldo por pagar. Los totales abarcan todos los acuerdos vinculados al identificador del proveedor y separan fondos propios de administrados. El detalle paginado enlaza a los movimientos de cada acuerdo. La búsqueda global y los favoritos incluyen proveedores y recordatorios personales pendientes según permisos. Se comprobaron pagos, reversos, aislamiento y favoritos. Pasaron 176 pruebas, TypeScript, ESLint, compilación, verificación de PDF y siete recorridos Playwright (uno omitido). Se restauró en PostgreSQL 17 una base sintética con 54 migraciones. Migración 054 pendiente de producción. Próxima validación financiera en preview: registrar acuerdo de proveedor, anticipo, recibo y reverso; contrastar su estado de cuenta y agenda con los movimientos.

### Clasificación de egresos y exportación
En un acuerdo se puede registrar un pago con categoría de materiales, mano de obra, maquinaria y equipo, servicios externos, permisos y gestorías, gastos del despacho u otros. Los pagos históricos sin categoría aparecen como Sin clasificar. Reportes y CSV concilian el total pagado por área, categoría y origen de fondos; los filtros de fecha, cliente, proyecto, obra, paquete y línea se aplican en SQL antes de agrupar. Se probaron abonos, reversos, exclusión de cobros, permisos y exportación con centavos exactos. 178 pruebas, TypeScript, ESLint, build, siete recorridos Playwright y restauración sintética con 55 migraciones correctos. Pendientes preview autenticada y migración de producción.

### Costo interno de las horas
Administración → Reportes y el expediente muestran costo imputado y minutos sin tarifa por separado del flujo efectivo. Las tarifas se registran por miembro y fecha de vigencia, en MXN por hora. Cada registro usa la tarifa aplicable en la fecha trabajada. Una tarifa cero se diferencia de una tarifa ausente. El cálculo redondea al centavo tras sumar los minutos ponderados. El reporte admite filtros de periodo, cliente, proyecto, paquete y línea; las horas se capturan a nivel de proyecto. Se probaron cambios de vigencia, falta de tarifa, cero, redondeo y permisos. Pasaron 179 pruebas, TypeScript, ESLint, compilación, Playwright (7 aprobadas y una omitida) y restauración con 56 migraciones. Migración 056 y recorrido autenticado pendientes.

### Margen de caja sobre cobros
El expediente del proyecto, el reporte por línea y su CSV calculan (cobros propios − pagos efectivos propios) ÷ cobros propios × 100, antes de imputar horas. El margen queda vacío para dinero administrado y cuando no hay cobros. La misma aritmética decimal se usa para el margen previsto sobre honorarios, con su base de cálculo separada. Se probaron margen negativo, denominador cero y exclusión de fondos del cliente. Pasaron 179 pruebas, TypeScript, ESLint, compilación y siete recorridos Playwright (uno omitido).

### Gestión de roles de miembros existentes
Configuración → Equipo permite al propietario cambiar entre administrador, colaborador y lector. La base comprueba el rol previo, protege al propietario y registra el cambio con fecha y actor. La prueba SQL comprobó el acceso a finanzas antes y después de asignar y retirar el rol administrativo, el rechazo a cambios obsoletos y la privacidad del historial. Pasaron 180 pruebas, TypeScript, ESLint, build y siete recorridos Playwright (uno omitido). PostgreSQL local restauró datos sintéticos con las 57 migraciones. Pendientes invitaciones, recorrido autenticado con dos usuarios y aplicación de las migraciones en producción tras validar la copia real.

### Invitaciones de acceso al equipo
El propietario invita por correo desde Configuración → Equipo. Comparte manualmente la dirección de la bandeja /invitaciones. El destinatario puede registrarse, confirmar su correo en Supabase Auth y aceptar el rol ofrecido dentro de siete días. El propietario puede consultar el estado y revocar una invitación pendiente. Se mantiene la regla existente de un estudio por cuenta y se comparte el bloqueo de creación de estudio para evitar membresías simultáneas. Pruebas de correo no confirmado, usuario ajeno, caducidad, revocación, reintento y carrera entre aceptación y creación. Pasaron 181 pruebas, TypeScript, ESLint, build, ocho recorridos Playwright (uno omitido) y restauración sintética con 58 migraciones. Falta probar el correo de confirmación y el ingreso con dos cuentas en preview. Producción pendiente.

### Tablas en documentos y plantillas
El editor inserta tablas de dos a seis columnas en el texto guardado. El PDF de vista previa y emisión dibuja sus filas y columnas, con variables resueltas en cada celda. Se reabrió un documento de 65 filas para verificar paginación, alineación y conservación de la última fila. Las barras verticales del nombre de un cliente permanecen dentro de su celda. Pasaron 182 pruebas, ESLint y build con verificación del paquete PDF. Sin migración adicional. Pendiente recorrido autenticado y revisión con documentos del estudio.

### Imágenes privadas en documentos
El editor inserta imágenes desde una revisión concreta de Biblioteca. Las plantillas conservan la referencia; la vista previa y la emisión consultan el adjunto bajo los permisos y la organización activos. El servidor comprueba la firma PNG/JPEG y limita bytes, píxeles y cantidad de imágenes antes de generar el PDF. Se reabrió un PDF con dos imágenes (membrete y adjunto) y texto posterior. Se probaron referencias inválidas, archivo no raster, imagen faltante y límite de imágenes. Pasaron 184 pruebas, TypeScript, ESLint, build y 8 recorridos Playwright (uno omitido). Sin migración adicional. Pendiente emisión autenticada con adjuntos reales de prueba.

### Ficha operativa del proyecto
Ubicación, responsable, fechas y estado se editan con control de versión. La agenda incorpora el cierre previsto de proyectos activos y pausados. Se verificaron permisos, fechas inválidas, ediciones simultáneas y conservación del acuerdo de cobro. Pasaron 185 pruebas y la restauración local con 59 migraciones.

### Archivos de clientes y proyectos
Cada expediente admite enlaces y archivos privados de hasta 2 MiB. Los permisos separan documentación comercial y técnica. Se probaron aislamiento entre estudios, escritura por rol, recuperación del archivo con sus bytes originales y rechazo de descargas sin sesión. Pasaron 186 pruebas, TypeScript, ESLint, build, 9 recorridos Playwright (uno omitido) y restauración con 60 migraciones. Pendiente recorrido con dos cuentas de prueba en preview.

### Condiciones reutilizables en las cotizaciones
Los presets guardan condiciones junto a partidas y notas. Al aplicarlos se conservan las cláusulas del borrador. Si el texto combinado excede el límite, el editor conserva el borrador completo. La API anterior mantiene las condiciones cuando edita el mismo preset. Pasaron 188 pruebas, lint, TypeScript, build, 9 recorridos Playwright y restauración local con 61 migraciones. Pendiente validación en preview.

### Recuperación de cotizaciones
Comercial → Cotizaciones permite filtrar archivadas por nombre y estado y restaurar una propuesta. Se conserva el documento emitido, se registra el actor y se rechazan versiones obsoletas y roles ajenos. Pasaron 189 pruebas, lint, TypeScript, build, 9 recorridos Playwright y restauración sintética con 62 migraciones. Pendiente validación remota.

### Cancelación del saldo de planes de proyecto
Administración permite cancelar exclusivamente lo pendiente, con motivo obligatorio. El historial conserva importe anterior, saldo cancelado, actor y fecha. La cartera y la agenda se actualizan y los pagos efectivos permanecen. La prueba multiconexión enfrentó cancelación y cobro sobre la misma obligación. Pasaron 190 pruebas, TypeScript, ESLint, build, nueve recorridos Playwright (uno omitido) y restauración con 63 migraciones. Pendientes validación autenticada y migración de producción.

### Inventario de migraciones en modo de solo lectura
npm run db:plan abre una transacción PostgreSQL de solo lectura y contrasta el historial registrado con los hashes SHA-256 locales. Detecta versiones desconocidas, cambios y huecos de secuencia. El 4 de noviembre la conexión configurada verificó las primeras 10 migraciones, sin diferencias en ese historial. De las 63 entonces existentes, 53 estaban pendientes, comenzando por 011. El inventario no certifica el respaldo, las políticas reales ni la compatibilidad de los registros. Pasaron 192 pruebas, lint, TypeScript y revisión de publicación.

### Flujo por área y custodia en Reportes
El reporte por periodo, cliente, proyecto, obra, paquete y línea muestra cobros, pagos, flujo y margen de caja propios por área. Los fondos administrados se agrupan aparte y los planes sin área atribuida mantienen su propio renglón. La tabla y el CSV usan la misma consulta con permisos de Supabase. Se conciliaron las tres áreas con pagos parciales y se comprobaron centavos por encima del rango entero seguro de JavaScript. Pasaron 194 pruebas, TypeScript, ESLint, build, nueve recorridos Playwright y restauración sintética con 64 migraciones.

### Navegación interna de expedientes
Clientes y proyectos ofrecen accesos de teclado y táctiles a las secciones disponibles para cada rol. Administración puede saltar a cobros, honorarios y rentabilidad. El cliente archivado omite el acceso al portal. Se comprobaron enlaces por rol y la condición de paquetes presentes. Pasaron 196 pruebas, lint, TypeScript, build y nueve recorridos Playwright (uno omitido). Falta el recorrido autenticado de cada expediente.

### Pruebas de interfaz con dos sesiones Supabase
npm run test:e2e:auth inicia una aplicación local exclusiva en el puerto 3419 conectada a Supabase local en 54321. Requiere las migraciones, una cuenta administradora y otra lectora confirmadas del estudio de prueba. Configurar ESTUDIO_TEST_PUBLISHABLE_KEY, ESTUDIO_TEST_ADMIN_EMAIL, ESTUDIO_TEST_ADMIN_PASSWORD, ESTUDIO_TEST_READER_EMAIL y ESTUDIO_TEST_READER_PASSWORD en .env.e2e.local (excluido de Git). El recorrido crea un acuerdo sintético de topografía, registra un anticipo, recarga la ficha, comprueba saldos y descarga el reporte. El segundo comprueba que el lector no puede consultar ni exportar finanzas. Playwright descubre ambos casos y TypeScript y ESLint pasan. Ejecución autenticada pendiente: no hay Supabase en el puerto local ni cuentas configuradas. El comando comprobó esta condición antes de iniciar la aplicación.

### Fases automáticas al aceptar cotizaciones
Administración puede activar una plantilla general por línea desde Fases del proyecto. Al aceptar una cotización o un extra, se copia la revisión vigente para cada línea configurada. La misma plantilla se incorpora una vez por proyecto. Se verificaron la aceptación de una cotización mixta, el aislamiento de la otra línea, el permiso del lector y la conservación del plan al editar su plantilla. Pasaron 197 pruebas, lint, TypeScript, build, nueve recorridos Playwright y restauración con 65 migraciones.

### Expedientes asociados al cliente
Desde el cliente se consultan proyectos, cotizaciones y obras con paginación y filtro por tipo. Una obra vinculada solo al proyecto se muestra en el cliente correspondiente. El lector accede a proyectos; las cotizaciones y obras están reservadas a administración. Las pruebas verificaron esta diferencia, el aislamiento y la exclusión de propuestas archivadas. Pasaron 198 pruebas, TypeScript, ESLint, build, nueve recorridos Playwright y restauración con 66 migraciones.

### Cartera por vencimiento
Administración → Cartera reúne las obligaciones vigentes de planes y acuerdos con enlace a su origen. Filtra por área, fondos, sentido y antigüedad en la zona horaria del estudio. Los cobros parciales reducen el saldo y los liquidados salen de la lista. Se verificaron los límites de 30 y 60 días, obligaciones sin fecha, aislamiento por estudio y rol. Pasaron 199 pruebas, TypeScript, ESLint, build, nueve recorridos Playwright y restauración con 67 migraciones.

### Membretes privados por revisión
Documentos, plantillas y cotizaciones admiten un membrete alternativo desde Biblioteca. La selección conserva el ID de la revisión y se usa en vista previa y emisión. El membrete oficial sigue disponible. Se reabrieron un PDF independiente de dos páginas y una cotización para comprobar que incorporan el recurso elegido. Se verificaron dimensiones carta y rechazo de revisiones faltantes. Pasaron 201 pruebas, TypeScript, lint, build con verificación del paquete PDF y nueve recorridos Playwright. Pendiente inspección visual con membretes de prueba en sesión autenticada.

### Revisión local del respaldo del tabulador
El propietario puede seleccionar la exportación JSON en Configuración. El navegador verifica su SHA-256, los conteos, IDs y referencias de presets y clientes. Compara importes de propuestas con la aritmética actual usando el IVA guardado, identifica porcentajes históricos y señala homónimos y folios repetidos. Se probó una propuesta conciliada y otra con diferencias. Pasaron 202 pruebas, TypeScript, lint, build y nueve recorridos Playwright. La revisión se hizo con datos sintéticos.

### Importación de clientes a staging
Configuración incorpora clientes por ID legado, reutiliza coincidencias exactas y rechaza registros archivados, diferencias y coincidencias ambiguas. Requiere entorno staging, rol propietario y habilitación expresa del estudio en la base aislada. Se probó que un conflicto al final revierte todo el lote. Pasaron 203 pruebas, TypeScript, lint, build, nueve recorridos Playwright y restauración sintética con 68 migraciones. Sin carga de datos reales. Restan catálogo, presets, propuestas y verificación del respaldo en staging.

### Variables de cotización en documentos y plantillas
El editor vincula una versión emitida. El folio, total y anticipo provienen de su snapshot tanto en la vista previa como en la preparación de la versión documental. Se validan la organización, el cliente y, cuando se selecciona, el proyecto. Una edición desde el cliente anterior conserva el vínculo. Los documentos previos sin cotización mantienen su formato. Se verificó una propuesta de 25.000 MXN con anticipo de 12.500 MXN. Pasaron 204 pruebas, TypeScript, lint, build, nueve recorridos Playwright y restauración sintética con 69 migraciones. Pendiente emisión autenticada en staging.

### Exportación de movimientos financieros
Reportes descarga cobros, pagos, anticipos y reversos bajo los filtros activos. Cada fila conserva origen, área, custodia, importe original y contribución efectiva al flujo. Un reverso aporta cero de efectivo y conserva fecha y motivo. La descarga toma una instantánea SQL y pide acotar la selección si supera 5.000 movimientos. Se verificaron importes, aislamiento y escape de celdas. Pasaron 206 pruebas, TypeScript, lint, build, nueve recorridos Playwright y restauración con 70 migraciones. El inventario de solo lectura del destino configurado confirmó 10 aplicadas y 60 pendientes.

### Diseño documental reutilizable en presets
El preset puede guardar el orden de secciones, los márgenes y la revisión del membrete. Al aplicarlo se guarda una copia en el borrador. La prueba de integración verifica que editar el preset o guardar el borrador desde un cliente anterior conserve el diseño copiado. Un diseño inválido revierte también el cambio de versión. Pasaron 207 pruebas, TypeScript, lint, build, nueve recorridos Playwright y restauración sintética con 71 migraciones.

### Historial de interacciones por oportunidad
Pipeline conserva llamadas, reuniones, correos y notas con fecha y autor en Supabase. El historial está paginado y se conserva al archivar la oportunidad. Se verificaron los permisos del administrador, lector y miembro de otro estudio, la protección del autor y el rechazo de escrituras sobre oportunidades archivadas. Pasaron 208 pruebas y la restauración sintética de 72 migraciones.

### Flujo del periodo en Inicio
El resumen y su desglose por área usan la misma consulta SQL y los mismos filtros de fechas y línea que el CSV. La prueba del panel contrasta un servicio propio con fondos de obra administrados y verifica la ausencia de margen propio sobre estos últimos. Pasaron 209 pruebas y nueve recorridos de navegación.

### Categorías de servicios por despacho
El catálogo ofrece sugerencias reutilizables al crear o editar servicios y permite filtrar activos y archivados por categoría. PostgreSQL agrupa diferencias de mayúsculas y espacios sin reescribir los nombres históricos. Pasaron 210 pruebas y la restauración sintética con 73 migraciones.

### Tareas iniciales al aceptar cotizaciones
Las plantillas de fases pueden contener tareas. Al incorporarlas manualmente o al aceptar una propuesta, PostgreSQL guarda la revisión y crea las tareas dentro de la misma transacción. La prueba de aceptación mixta comprueba dos pendientes en el tablero y la conservación de ambos tras editar la plantilla. Pasaron 210 pruebas, compilación y restauración con 74 migraciones.

### Paginación del catálogo
El directorio presenta páginas de 30 servicios con conteo total y un orden estable. La búsqueda, categoría y selección de archivados se conservan al avanzar. Se verificó la recuperación de la segunda página y el enlace a la tercera. El inventario remoto de solo lectura confirmó 10 migraciones aplicadas y 64 pendientes hasta la 074.

### Importación selectiva de servicios en staging
Configuración admite un servicio por identificador verificado y exige elegir la línea de destino y una exportación con moneda MXN. PostgreSQL conserva el precio en centavos, la tarifa porcentual y el estado archivado. El propietario solo puede escribir en un estudio de ensayo habilitado. Repetir una importación coincidente conserva el registro y una discrepancia detiene la operación. Se probaron duplicados, fracciones de centavo y porcentajes fuera de rango. Pasaron 213 pruebas y la restauración sintética con 75 migraciones. En el destino configurado hay 10 aplicadas y 65 pendientes. Falta validar un respaldo real y recuperar los presets y propuestas.

### Presets del tabulador en staging
El propietario puede recuperar un preset por identificador después de importar sus servicios. Se comprueba la totalidad de las referencias antes de crear el registro, con el mismo orden y cantidades del legado. Los reintentos y los conflictos sobre registros editados tienen cobertura en PostgreSQL. Pasaron 214 pruebas, lint, TypeScript, build, nueve recorridos Playwright y restauración de 76 migraciones. El inventario de solo lectura confirmó 10 migraciones aplicadas y 66 pendientes. El siguiente bloque de migración es la conciliación individual y recuperación de las propuestas históricas.

### Conciliación individual de propuestas
El informe local permite revisar por folio e identificador el total histórico, el recalculado y la diferencia de subtotal y descuentos. Usa el IVA registrado en cada propuesta. Una prueba reproduce una diferencia de 178,20 al comparar una partida porcentual histórica con el cálculo actual. La revisión conserva intactos el archivo y la base de datos.

### Archivo histórico de propuestas en staging
El propietario puede conservar y consultar una propuesta histórica por su identificador, junto con sus partidas, folio, moneda de configuración y huella de origen. El vínculo al directorio exige coincidencia por ID. Se verificó que el contenido, incluidos los importes, permanece idéntico tras reintentos y que la operación conserva los conteos de cotizaciones operativas, proyectos, acuerdos y cobros. Pasaron 215 pruebas y se restauraron 77 migraciones en PostgreSQL 17 con datos sintéticos. El inventario remoto confirmó 10 migraciones aplicadas y 67 pendientes. La suite autenticada se detiene antes de iniciar sesión por falta de la clave local y las cuentas de administrador y lector. Pendientes el ensayo con copia real, la conciliación de PDFs y la importación de conceptos.

### Conceptos históricos en la biblioteca comercial
La importación de staging verifica huella e identidad y conserva el texto original del concepto. La prueba cubre acentos, m², saltos de línea, espacios finales, reintentos, nombres duplicados y conflicto tras una edición local. Pasaron 216 pruebas automatizadas y la restauración sintética con 78 migraciones. La revisión de solo lectura del destino configurado encontró 10 migraciones verificadas y 68 pendientes. El bloque local siguiente es la exportación general por permisos. Siguen pendientes la restauración de una copia real con Storage y los recorridos autenticados de administrador y lector.

### Exportación operativa del despacho
Configuración permite al propietario descargar los registros visibles de cinco módulos, juntos o por sección, bajo las políticas de Supabase. Una lectura consistente incorpora las referencias y metadatos documentales. Los binarios requieren el respaldo de archivos. La descarga conserva los números originales de PostgreSQL y admite hasta 3.500.000 bytes de registros por selección. El navegador comprueba la huella SHA-256 y los conteos sin enviar el archivo. Se verificó el aislamiento entre estudios, la denegación a otros roles y la exclusión de adjuntos. Pasaron 219 pruebas y la restauración sintética con 79 migraciones.

### Paquetes de trabajo por proyecto
Los administradores pueden agregar paquetes operativos a proyectos activos o pausados y editar su nombre e instrucciones con control de versión. La ficha identifica por separado el alcance contratado. La prueba cubre dos líneas en el mismo proyecto, reintento sin duplicado, edición obsoleta, permisos y rechazo de cambios después del cierre. Crear el paquete no programa cobros ni asigna un ingreso contratado. Pasaron 220 pruebas y la restauración con 80 migraciones.

### Tarifa interna prevista en cotizaciones
El editor permite guardar un costo horario opcional y distingue una tarifa de cero de una tarifa pendiente. El costo imputado se redondea al centavo tras multiplicar horas por tarifa, se descuenta una sola vez y se mantiene fuera del PDF para el cliente. La ficha muestra el margen interno sobre el ingreso sin IVA. Se probaron pérdidas, compatibilidad con borradores anteriores, rechazo de importes fuera de rango y conservación de la versión tras un fallo. Pasaron 222 pruebas y la restauración sintética con 81 migraciones.

### Indicadores operativos por periodo y línea
Inicio aplica la selección persistente del usuario al conteo y detalle de proyectos activos, propuestas enviadas, pendientes vencidos, entregas de los próximos siete días y flujo. Los cortes se realizan sobre inicio, envío, vencimiento o fecha efectiva según el indicador. El detalle paginado abre el registro correspondiente. Un proyecto con dos paquetes de la misma línea se cuenta una sola vez. Se verificaron aislamiento, visibilidad del lector, selección de fechas y navegación a la segunda página. La cartera acumulada conserva su fecha de corte actual. Restauración sintética con 82 migraciones.

### Recorrido de aceptación con autenticación y Storage
Playwright ya descubre tres recorridos autenticados. El más reciente crea un cliente y una cotización de 25.000 MXN, comprueba su margen interno, emite y abre el PDF privado, registra el envío, acepta la propuesta y verifica que el anticipo de 12.500 MXN queda programado con cero recibido. Compara la huella del PDF tras la aceptación. La ejecución autenticada se detuvo al validar la configuración local: faltan la clave publicable y las cuentas de administrador y lector. No se ha probado ese recorrido contra un servidor de Auth o Storage en esta máquina.
Pasaron 224 pruebas Vitest, ESLint y TypeScript; el build validó el empaquetado PDF y Playwright completó nueve recorridos de navegación con uno omitido por configuración. El inventario de solo lectura confirmó 10 migraciones aplicadas y 72 pendientes, sin diferencias de huella. El siguiente bloque de cálculo pendiente es la atribución de costos internos por partida con conservación de valores históricos.

### Costos directos por partida
La cotización copia el costo del servicio al agregarlo y permite modificarlo para esa propuesta. PostgreSQL calcula y redondea cada partida al centavo antes de sumar. En las partidas porcentuales la cantidad representa un presupuesto de obra, por lo que el campo de costo es un importe fijo en MXN. Los descuentos y el IVA siguen afectando únicamente los importes de venta. Una edición de catálogo no altera la copia. Los formularios anteriores conservan costos cuando la correspondencia de partidas es reconocible y se rechaza una edición ambigua. Pasaron 226 pruebas y la restauración sintética con 83 migraciones.

### Estimación interna histórica por versión documental
Al preparar una versión se guarda por separado el desglose de costos, horas, tarifas y resultado previsto. Comercial puede inspeccionarlo junto al folio emitido. Las versiones antiguas sin estimación se identifican expresamente. La prueba cambia un costo en el borrador y comprueba tanto la conservación de la estimación anterior como su exclusión del contenido para el cliente. Pasaron 227 pruebas y la restauración sintética con 84 migraciones.

### Margen consolidado del proyecto
El expediente suma los honorarios sin IVA y los costos directos, externos y de horas del contrato base y sus ampliaciones aceptadas. Advierte de horas pendientes de tarifa y de propuestas anteriores al historial privado. Pasaron 227 pruebas y la restauración con 85 migraciones en PostgreSQL 17.

### Ejecución por paquete en el expediente
Cada paquete muestra su presupuesto sin IVA, cobros, pagos y minutos, con acceso al reporte filtrado. Los movimientos generales permanecen en una fila separada. El flujo propio excluye los fondos de clientes para obra, visibles en sus propias columnas. Las pruebas verifican atribución por obra, anticipos generales, minutos, separación de fondos y permisos de lector. Pasaron 227 pruebas, ESLint, compilación, TypeScript y nueve recorridos Playwright con uno omitido. PostgreSQL 17 restauró las 86 migraciones en una base sintética. El plan de solo lectura registra diez aplicadas y 76 pendientes, sin divergencias.

### Honorarios por área y origen de fondos
La captura del honorario pide el área y el origen del dinero antes de crear la cuenta por pagar. Los honorarios históricos conservan su clasificación original. Una prueba registra pagos parciales de servicio, obra con fondos propios y obra con fondos del cliente y concilia los tres saldos contra el expediente. Pasaron 228 pruebas y la restauración de 87 migraciones.

### Estado de cuenta por cambio de alcance
Cada solicitud vinculada muestra la cotización y sus obligaciones vigentes, cobros efectivos, saldo pendiente y cancelaciones. La prueba de aceptación comprueba que un cobro al contrato base queda fuera de la ampliación y verifica el efecto de un cobro parcial, su reverso y una cancelación tras reprogramar. El lector no puede consultar el estado de cuenta. Pasaron 228 pruebas y se restauraron 88 migraciones en PostgreSQL 17.

### Cobro y seguimiento de obligaciones por ampliación
Desde el estado de cuenta de una ampliación se abren sus obligaciones y su historial de pagos. El plan del expediente pagina por fecha e identificador. La prueba crea 505 obligaciones y confirma que se puede consultar y abonar la última. El selector distingue contrato base y ampliación e indica el vencimiento. Pasaron 229 pruebas, la compilación, TypeScript, ESLint y nueve recorridos de navegador con uno omitido. Se restauraron 89 migraciones sintéticas. El plan remoto de solo lectura verificó diez aplicadas y 79 pendientes. Playwright descubre el recorrido ampliado de propuesta, anticipo parcial, descarga de recibo y reverso. Su ejecución autenticada sigue pendiente por falta de la clave y las cuentas del Supabase aislado.

### Cobros de planes atribuidos a un paquete
Administración y el expediente permiten asignar un cobro al paquete correspondiente del contrato base o la ampliación. Dejar el campo vacío conserva la atribución general. La base rechaza paquetes de otro alcance y reintentos que cambian la asignación. Los filtros de paquete y línea en Inicio, productividad, flujo y CSV incluyen el movimiento. Un reverso deja el rastro en el historial y el CSV y retira el importe del flujo. El archivo de movimientos incluye el nombre del paquete y de la línea.
Pasaron 229 pruebas, ESLint, TypeScript, la compilación y nueve recorridos de navegador con uno omitido. La restauración sintética en PostgreSQL 17 llegó a 90 migraciones. El inventario remoto de solo lectura verificó diez aplicadas y 80 pendientes. Continúa pendiente la validación autenticada con Auth y Storage en el Supabase de ensayo.

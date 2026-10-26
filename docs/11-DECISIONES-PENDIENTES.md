# 11 — Decisiones pendientes y supuestos

**No detener el diseño completo por estas dudas**; implementar interfaces desacopladas y registrar supuestos. Pedir confirmación antes de decisiones costosas o irreversibles.

- [ ] Nombre final y marca del sistema (ESTUDIO OS es provisional).
- [ ] En línea / offline / híbrido (supuesto: online, adaptable a móvil).
- [ ] Solo propietario al inicio o varios usuarios desde día uno (supuesto: uno, arquitectura multiusuario).
- [ ] Uso exclusivamente interno o eventual comercialización SaaS (supuesto: interno).
- [ ] Identidad visual definitiva (supuesto: minimalismo tipo Notion).
- [ ] Porcentajes de reparto de honorarios y reglas fiscales específicas (configurables; no codificar valores particulares).
- [ ] Confirmar ubicación y forma de exportación de datos reales del navegador.
- [x] PNG carta real recibido; pendiente calibración y pruebas de PDFs nuevos.
- [ ] Decidir almacenamiento, proveedor de email/notificaciones y dominio antes de despliegue.
- [ ] Definir límites de edición y aprobación de documentos, clientes y presupuestos.

## Registro de decisiones
Anotar fecha, decisión, motivo, impacto, autor y archivos modificados. No asumir acuerdos no confirmados.

### 2026-10-19 — implementación (Codex)
- Monolito modular Next.js 16/Supabase conforme al stack. Sin credenciales no se simula conexión; integración remota pendiente.
- Dinero en centavos enteros, decimal.js, HALF_UP por partida/descuento y luego IVA sobre neto. Corrige fallo pct del legado; diferencias deben reconciliarse antes de importar. Ver money.test.ts/AUDITORIA-LEGACY.md.
- UI neutra cálida y acento verde de recursos; fuente de sistema provisional. No se declaran colores/tipografía corporativos definitivos.
- Membrete carta exacta; reserva inferior legado verificada: 22+4 mm. Calibración nueva pendiente.
- PGlite solo pruebas SQL, no sustituto productivo ni de autenticación Supabase.
- Webpack por error de subproceso Turbopack del sandbox Windows; build verificado con permisos del entorno.
- Todo el alcance continúa pendiente por bloques; rutas futuras informan estado sin KPIs o botones ficticios.
- PDF: React PDF con Noto Sans libre en WOFF (licencia incluida), evaluado frente a defectos del jsPDF legado; numeración posprocesada con pdf-lib tras detectar posicionamiento incorrecto del texto dinámico. Imágenes del membrete sin transformación; no se reutiliza la conversión ASCII.
- Las cinco migraciones son aditivas, aún no aplicadas externamente. Folio por organización/año; preparación puede dejar huecos, nunca reutiliza números. Estado enviado solo mediante registro manual explícito, no al generar PDF.
- Conversión comercial a producción/cobros se trabajó como corte vertical para verificar integridad entre bloques; no implica cerrar Comercial/Documentos ni omitir sus pendientes. Alcance completo rastreado en TRAZABILIDAD.md.
- No sustituir Supabase por almacenamiento simulado para desbloquear UI. Se implementa y prueba SQL con PostgreSQL embebido, conservando pendiente la verificación contra proveedor real.
- El usuario confirmó que aún no dispone de proyecto Supabase y pidió continuar. Se avanza sin solicitar credenciales de nuevo; no se activa un backend alternativo ni un modo simulado.
- Migraciones 006/007 aditivas: ciclo comercial con motivo/versiones y documentos independientes. El contador existente por estudio/año asigna folios con prefijos COT/DOC; pueden existir huecos entre tipos y preparaciones.
- Primer editor de documentos independientes acotado a texto, subtítulos, listas, saltos y variables seguras; tablas/imágenes y plantillas reutilizables permanecen pendientes. No presentarlo como editor enriquecido completo.

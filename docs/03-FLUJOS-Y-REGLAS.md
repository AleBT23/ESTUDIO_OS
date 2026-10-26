# 03 — Flujos y reglas de negocio

## Flujo comercial a ejecución
1. Crear prospecto y oportunidad; seleccionar línea prevista.
2. Seleccionar cliente y servicios/preset; editar cantidades, precios y alcance.
3. Crear cotización en borrador y previsualizar PDF con membrete.
4. Emitir versión inmutable, registrar fecha de envío y seguimiento.
5. Al aceptar, crear proyecto vinculado, paquetes por línea, fases y tareas desde plantillas.
6. Programar anticipo y parcialidades. **No registrar como pagado automáticamente**.
7. Ejecutar tareas y entregables, registrar tiempo y gastos.
8. Cotizar extras mediante solicitud de cambio y aprobación independiente.
9. Cerrar proyecto, calcular rentabilidad y archivar expediente.

## Arquitectura vs visualización
- Arquitectura: levantamiento > análisis > anteproyecto > desarrollo > ejecutivo > entrega (solo fases contratadas).
- Visualización: recepción de insumos > modelado > materiales/iluminación > previews > revisiones > entrega (según servicio).
- Las fases son presets editables, no secuencias obligatorias.
- Proyecto mixto: un expediente y cliente; paquetes con presupuestos, tareas, horas y gastos atribuibles.

## Cálculos y consistencia
- Moneda MXN por defecto, otras monedas solo con reglas explícitas de conversión; no sumar monedas diferentes sin tipo de cambio registrado.
- Importes con decimal exacto y redondeo monetario definido en un único servicio; subtotal, descuentos, impuestos y total visibles.
- IVA configurable por presupuesto; no asumir que todos los servicios lo llevan.
- Presupuesto emitido conserva snapshot de conceptos, precios, textos y PDF.
- Plan de pago y movimiento de cobro son entidades diferentes.
- Rentabilidad estimada: precio contratado menos costos estimados. Rentabilidad real: ingresos devengados o cobrados (según reporte claramente rotulado) menos costos; reportar por separado el costo imputado de horas para evitar doble conteo.
- Cancelaciones y reversos mediante estados/eventos, no borrado silencioso.
- Ediciones concurrentes deben evitar pérdida de cambios (versión/updated_at).

## Ejemplo de aceptación
Cotización de 25,000 MXN, anticipo del 50%: crear obligación de 12,500 MXN y saldo planeado de 12,500 MXN; el cobrado permanece 0 hasta registrar pago efectivo.

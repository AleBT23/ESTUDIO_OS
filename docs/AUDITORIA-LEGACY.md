# Auditoría inicial del legado — 19 de octubre de 2026

## Alcance y evidencia
Se leyeron README, AGENTS, los doce documentos de docs/ y BRANDING; se enumeró la carpeta completa antes de crear código. El material inicial contenía documentación, cinco PNG y un RAR; no había aplicación nueva, configuración, BD ni repositorio Git.

RAR original intacto. Extracción en `.audit/legacy/tabulador de precios v2/` (excluida de Git). `npm run audit:legacy` genera `tests/fixtures/legacy-inventory.json`: siete archivos, tamaño, SHA-256, líneas y funciones. Pruebas verifican hashes. Repetir: crear .audit/legacy y ejecutar `tar -xf 'legacy/tabulador de precios v2.rar' -C .audit/legacy`.

## Campos exactos de persistencia
| Clave LocalStorage | Contenido observado en código |
| --- | --- |
| archiquote_services | Array `{id,name,unit,price,description,active}`. 15 defaults; cargar un array vacío vuelve a sembrarlos. |
| archiquote_clients | Array `{id,name,phone,email,createdAt}`. Dirección solo en propuesta. |
| archiquote_concept_library | Array `{id,name,text}`. Insertar copia texto, no enlaza. |
| archiquote_presets | Array `{id,name,serviceIds:string[]}`. Servicios vivos al aplicar; cantidad 1, descuento 0, descripción vacía; omite referencias faltantes. |
| archiquote_proposals | Array; guardar id existente sobrescribe sin versión. Campos abajo. |
| archiquote_settings | `{vat,currency,letterheadPath,applyVat}`; merge defaults; seis monedas sin conversión. |
| archiquote_proposal_counter | Entero global; no reinicia por año; folio COT-YYYY-NNN. |
| archiquote_letterhead_b64 | String crudo data URL, no JSON; FileReader. |

Propuesta: `id,proposalNumber,clientId,clientName,clientPhone,clientEmail,clientAddress,projectName,notes,date,items,subtotal,discount,vat,grandTotal,applyVat,profitability,createdAt,updatedAt`.

Partida: `id,serviceName,description,conceptDescription,quantity,unit,unitPrice,discount`. Sin id de servicio ni línea. Unidades: m2,unit,hour,visit,fixed,pct.

Rentabilidad: `estimatedHours,expenses,travelCosts,grossRevenue,netProfit,profitMargin`. Horas sin costo imputado. Ingreso neto de descuentos sin IVA; utilidad resta gastos/viáticos. Datos internos se imprimen en PDF si existen valores.

## Cálculos y defectos
- Base cantidad × precio; descuento porcentual por partida; IVA sobre suma neta. Number binario sin redondeo centralizado ni validación suficiente.
- **Error pct**: costo 1,000,000 y tarifa 8 generan 8,000,000 en vez de 80,000. Caracterizado; nueva lógica lo corrige expresamente. No afirmar equivalencia.
- Copiar conceptos/precios no modifica catálogo: preservar.
- Eliminar cliente conserva propuestas. Asociación sin clientId por nombre: ambigua con homónimos; no resolver migración silenciosamente.
- Estadísticas suman propuestas sin estados ni separación de monedas; no son cobros.
- Settings puede eliminar todas las claves. No se ejecutó ni se inicializó el legado.

## PDF
jsPDF 2.5.1 CDN. Carta 215.9 × 279.4 mm; márgenes izquierda 16, derecha 32, superior 22; reserva inferior 22 más buffer 4 mm. Fondo en todas las páginas sin verificar proporción. Tabla 45/10/15/15/15%; saltos por fila sin repetir encabezado; fila mayor al área puede desbordar. Notas largas como bloque sin paginación por líneas. ASCII elimina acentos, ñ y ²; excepción m2. Preview HTML distinto del render PDF.

Sin aceptación ni PDF emitido inmutable. Cambiar ajustes altera exportaciones. Rentabilidad interna puede salir al cliente: excluir en nuevo renderer por defecto. No se afirma equivalencia visual ni validación de PDF nuevo.

## Marca
Logo color 2745×1100; isotipo color 1099×1099; versiones negativas conservadas. Membrete 2550×3300, carta exacta a 300 dpi. Inspección visual de logo/isotipo/membrete; franja derecha y datos inferiores exigen calibración. Copias UI sin transformación; documentos de clientes privados. Colores UI basados en imagen, provisionales; fuente de sistema provisional.

## Exportación segura
1. Abrir tabulador ORIGINAL con datos visibles en su navegador/origen habitual. No limpiar ni abrir copia vacía.
2. Descargar public/legacy-export.js desde Configuración; revisar y pegar íntegro en consola de ese navegador.
3. JSON versionado conserva strings originales, incluso JSON defectuoso, fecha/origen/conteos y SHA-256 de JSON.stringify(payload). No escribe LocalStorage ni envía red. Si Web Crypto no está disponible, detiene sin modificar.
4. Guardar original y segunda copia privados; verificar con verifyLegacyBackup. Checksum prueba integridad, no autenticidad.
5. Pendiente UI de validación/importación staging, duplicados/referencias, conciliación monetaria y PDFs reales. Ningún dato real exportado/importado.
6. Reversión: conservar tabulador/navegador original, exportaciones y respaldo BD. No activar migración sin aprobación.

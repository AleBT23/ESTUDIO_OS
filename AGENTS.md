# Instrucciones permanentes para Codex — ESTUDIO OS

Lee `README.md` y **todos** los archivos de `docs/` antes de modificar código. Respeta sus requisitos; si existe conflicto, documenta la decisión y pide aclaración para cambios de alcance.

## Modo de trabajo
- Construye una única aplicación con arquitectura modular, no diez apps ni dos dashboards.
- Implementa de extremo a extremo por incrementos pequeños; el alcance objetivo incluye todas las áreas descritas.
- No marques un módulo como terminado con mocks, botones inertes, datos hardcodeados o flujos incompletos.
- Ejecuta lint, typecheck y pruebas tras cada incremento; corrige errores antes de seguir.
- Actualiza `docs/ESTADO.md` con qué funciona, qué falta, comandos, decisiones y pruebas.
- Antes de refactorizar el legado, crea un inventario verificable y pruebas de comportamiento de cálculos y PDFs.
- Nunca borres datos existentes ni hagas migraciones destructivas sin respaldo, plan de reversión y confirmación.
- Mantén secretos fuera del repositorio; crea `.env.example` sin credenciales.
- No asumas que el RAR contiene los datos guardados en el navegador.
- Usa español en la interfaz y en textos de usuario; código y nombres técnicos pueden estar en inglés.
- Si faltan claves externas o credenciales, prepara adaptadores y explica la configuración sin inventar éxito de despliegue.

## Prioridades
Integridad de datos y cálculo > flujos reales > claridad de UX > estética. Reutiliza la lógica del sistema anterior cuando las pruebas lo justifiquen.

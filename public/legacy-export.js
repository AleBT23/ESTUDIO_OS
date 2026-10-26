/* Ejecutar íntegro en la consola del tabulador ORIGINAL, con sus datos visibles.
 * Solo lectura. No carga defaults, no guarda, no elimina ni envía datos a la red.
 * El checksum cubre JSON.stringify(payload). Guardar el JSON en ubicación privada.
 */
(async () => {
  const keys = ['archiquote_services','archiquote_proposals','archiquote_settings','archiquote_proposal_counter','archiquote_letterhead_b64','archiquote_concept_library','archiquote_clients','archiquote_presets'];
  const entries = {}; const counts = {}; const errors = [];
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    entries[key] = raw;
    if (raw === null) { counts[key] = 0; continue; }
    if (key === 'archiquote_letterhead_b64') { counts[key] = raw.length ? 1 : 0; continue; }
    try { const value = JSON.parse(raw); counts[key] = Array.isArray(value) ? value.length : 1; }
    catch { errors.push(`JSON inválido conservado: ${key}`); counts[key] = null; }
  }
  const payload = { format: 'estudio-os-legacy', version: 1, exportedAt: new Date().toISOString(), origin: location.origin, entries, counts, errors };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (!globalThis.crypto?.subtle) throw new Error('Este navegador no permite verificar SHA-256 en este contexto. No se exportó ni modificó información.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const checksum = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
  const file = new Blob([JSON.stringify({payload,checksum:{algorithm:'SHA-256',value:checksum}},null,2)],{type:'application/json'});
  const href=URL.createObjectURL(file);const link=document.createElement('a');
  link.href=href;link.download=`estudio-os-legacy-${payload.exportedAt.replace(/[:.]/g,'-')}.json`;link.click();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
  console.table(counts);console.info('Respaldo exportado. Conserva el original. Huella SHA-256:',checksum);if(errors.length)console.warn(errors);
})();

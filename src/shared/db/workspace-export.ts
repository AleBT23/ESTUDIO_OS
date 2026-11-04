export async function verifyWorkspaceExport(file: File) {
  const expected = /^estudio-os-([0-9a-f]{64})(?: \(\d+\))?\.json$/i
    .exec(file.name)?.[1]
    ?.toLowerCase();
  if (!expected || file.size > 4 * 1024 * 1024)
    throw Error(
      "Selecciona una exportación con su nombre de descarga y un tamaño de hasta 4 MiB.",
    );
  const bytes = await file.arrayBuffer();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== expected)
    throw Error(
      "La huella del contenido difiere de la del nombre del archivo.",
    );
  const value = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  if (
    value?.format !== "estudio-os-workspace" ||
    value.version !== 1 ||
    typeof value.organization_id !== "string" ||
    typeof value.exported_at !== "string" ||
    !value.collections ||
    typeof value.collections !== "object" ||
    Array.isArray(value.collections)
  )
    throw Error("Formato de exportación desconocido.");
  const groups = Object.entries(value.collections);
  let records = 0;
  for (const [, group] of groups) {
    if (
      !group ||
      typeof group !== "object" ||
      !("rows" in group) ||
      !Array.isArray(group.rows) ||
      !("count" in group) ||
      group.count !== group.rows.length ||
      group.rows.some((row) => row?.organization_id !== value.organization_id)
    )
      throw Error(
        "Los conteos o el estudio de los registros son inconsistentes.",
      );
    records += group.rows.length;
  }
  if (!groups.length) throw Error("Sin colecciones para verificar.");
  return {
    organization: value.organization_id as string,
    exportedAt: value.exported_at as string,
    collections: groups.length,
    records,
  };
}

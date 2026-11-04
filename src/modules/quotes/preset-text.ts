export function mergePresetText(
  draft: { notes: string; conditions: string },
  preset: { notes: string; conditions: string },
) {
  const notes = [draft.notes, preset.notes].filter(Boolean).join("\n\n");
  const conditions = [draft.conditions, preset.conditions]
    .filter(Boolean)
    .join("\n\n");
  if (notes.length > 10000 || conditions.length > 20000) return null;
  return { notes, conditions };
}

type TableRow = { kind: "row"; cells: string[]; header: boolean };
export type DocumentLine = string | TableRow;

function cells(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const columns = trimmed
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((s) => s.trim().replaceAll("\\|", "|"));
  return columns.length >= 2 && columns.length <= 6 ? columns : null;
}
export function documentLines(body: string): DocumentLine[] {
  const lines = body.split(/\r?\n/),
    blocks: DocumentLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const header = cells(lines[i]),
      separator = header && cells(lines[i + 1] ?? "");
    if (
      !header ||
      !separator ||
      separator.length !== header.length ||
      !separator.every((s) => /^-{3,}$/.test(s))
    ) {
      blocks.push(lines[i]);
      continue;
    }
    blocks.push({ kind: "row", cells: header, header: true });
    i++;
    while (i + 1 < lines.length) {
      const row = cells(lines[i + 1]);
      if (!row || row.length !== header.length) break;
      blocks.push({ kind: "row", cells: row, header: false });
      i++;
    }
  }
  return blocks;
}

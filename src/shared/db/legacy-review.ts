import Decimal from "decimal.js";
import { calculateQuote } from "@/shared/money";
import { verifyLegacyBackup } from "./legacy-backup";

const groups = [
  "clients",
  "services",
  "concept_library",
  "presets",
  "proposals",
] as const;
type Group = (typeof groups)[number];
type Row = Record<string, unknown>;
function record(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function uniqueNames(rows: Row[], field: string) {
  const seen = new Set<string>(),
    duplicates = new Set<string>();
  for (const row of rows) {
    const value = text(row[field]).normalize("NFKC").toLocaleLowerCase("es-MX");
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates.size;
}
function reconcile(row: Row) {
  if (!Array.isArray(row.items) || !row.items.length) throw Error();
  const items = row.items.map((item: unknown) => {
    if (
      !record(item) ||
      !["m2", "unit", "hour", "visit", "fixed", "pct"].includes(text(item.unit))
    )
      throw Error();
    return {
      unit: text(item.unit),
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      discount: String(item.discount ?? 0),
    };
  });
  const sum = calculateQuote(items, "0", false);
  const cents = (v: unknown) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw Error();
    return new Decimal(v).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  };
  // El legado guardó el importe de IVA de cada propuesta, no su tasa histórica.
  const differences =
    !cents(row.subtotal).eq(sum.subtotal) ||
    !cents(row.discount).eq(sum.discount) ||
    !cents(row.grandTotal).eq(cents(row.vat).plus(sum.total));
  return { differences, percentage: items.some((i) => i.unit === "pct") };
}
export async function reviewLegacyBackup(value: unknown) {
  const { payload, issues: integrity } = await verifyLegacyBackup(value);
  const issues: string[] = [],
    counts: Partial<Record<Group, number>> = {},
    ids = new Map<Group, Set<string>>(),
    data = new Map<Group, Row[]>();
  let issueCount = 0;
  function note(message: string) {
    issueCount++;
    if (issues.length < 100) issues.push(message);
  }
  for (const message of integrity) note(message);
  for (const group of groups) {
    const raw = payload.entries[`archiquote_${group}`];
    let parsed: unknown = [];
    if (raw !== null) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        note(group + " contiene JSON inválido.");
        continue;
      }
    }
    if (!Array.isArray(parsed)) {
      note(group + " debe contener una lista.");
      continue;
    }
    const entries: Row[] = [],
      keys = new Set<string>();
    parsed.forEach((row: unknown, index: number) => {
      if (!record(row)) {
        note(group + " · fila " + (index + 1) + ": registro inválido.");
        return;
      }
      entries.push(row);
      const id = text(row.id);
      if (!id || keys.has(id))
        note(
          group +
            " · fila " +
            (index + 1) +
            ": identificador vacío o duplicado.",
        );
      if (id) keys.add(id);
    });
    ids.set(group, keys);
    data.set(group, entries);
    counts[group] = parsed.length;
  }
  const settingsRaw = payload.entries.archiquote_settings;
  if (settingsRaw !== null) {
    let settings: unknown;
    try {
      settings = JSON.parse(settingsRaw);
    } catch {
      settings = null;
    }
    if (!record(settings) || settings.currency !== "MXN")
      note("Verifica la moneda de origen antes de importar importes en MXN.");
  }
  const clients = ids.get("clients") ?? new Set(),
    services = ids.get("services") ?? new Set();
  const homonyms = uniqueNames(data.get("clients") ?? [], "name");
  if (homonyms)
    note(
      "Clientes con nombre repetido: " +
        homonyms +
        " grupos. Conservar la identidad por ID.",
    );
  const folios = uniqueNames(data.get("proposals") ?? [], "proposalNumber");
  if (folios) note("Folios repetidos: " + folios + " grupos.");
  for (const [i, preset] of (data.get("presets") ?? []).entries()) {
    if (
      !Array.isArray(preset.serviceIds) ||
      preset.serviceIds.some((id: unknown) => !services.has(text(id)))
    )
      note("Preset " + (i + 1) + ": revisar referencias de servicios.");
  }
  let matched = 0,
    different = 0,
    unreadable = 0;
  for (const [i, row] of (data.get("proposals") ?? []).entries()) {
    if (!clients.has(text(row.clientId)))
      note("Propuesta " + (i + 1) + ": sin cliente identificado por ID.");
    try {
      const result = reconcile(row);
      if (result.differences) {
        different++;
        note("Propuesta " + (i + 1) + ": hay diferencias de importes.");
      } else matched++;
      if (result.percentage)
        note(
          "Propuesta " +
            (i + 1) +
            ": revisar la base histórica de las partidas porcentuales.",
        );
    } catch {
      unreadable++;
      note("Propuesta " + (i + 1) + ": partidas o importes no conciliables.");
    }
  }
  return {
    services: (data.get("services") ?? []).map((row) => ({
      id: text(row.id),
      name: text(row.name),
    })),
    counts,
    issues,
    issueCount,
    matched,
    different,
    unreadable,
    exportedAt: payload.exportedAt,
  };
}

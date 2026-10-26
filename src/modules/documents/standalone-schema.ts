import { z } from "zod";
import { defaultDocumentOptions } from "./schema";
import { formatMoney, splitAdvance } from "@/shared/money";
export const documentKinds = {
  letter: "Carta",
  official: "Oficio",
  minutes: "Minuta",
  site_report: "Reporte de visita",
};
export const safeVariables = [
  "cliente.nombre",
  "proyecto.nombre",
  "cotizacion.folio",
  "cotizacion.total",
  "cotizacion.anticipo",
  "fecha",
  "despacho.nombre",
] as const;
const variablePattern = /{{\s*([^{}]+?)\s*}}/g;
export function templateVariables(body: string) {
  const variables = [...body.matchAll(variablePattern)].map((match) =>
    match[1].trim(),
  );
  for (const key of variables)
    if (!(safeVariables as readonly string[]).includes(key))
      throw new Error("Variable no permitida: " + key);
  const rest = body.replace(variablePattern, "");
  if (rest.includes("{{") || rest.includes("}}"))
    throw new Error("Hay una variable sin cerrar correctamente.");
  return [...new Set(variables)];
}
export function resolveVariables(
  body: string,
  values: Record<string, string | undefined>,
) {
  const needed = templateVariables(body);
  const missing = needed.filter(
    (key) => values[key] === undefined || values[key] === "",
  );
  if (missing.length)
    throw new Error("Faltan datos para: " + missing.join(", ") + ".");
  return body.replace(
    variablePattern,
    (_match, key: string) => values[key.trim()]!,
  );
}
export const marginsSchema = z.object({
  top: z.number().min(22).max(60),
  bottom: z.number().min(26).max(60),
  left: z.number().min(12).max(45),
  right: z.number().min(24).max(50),
});
export const standaloneInputSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    kind: z.enum(["letter", "official", "minutes", "site_report"]),
    body: z.string().trim().min(1).max(40000),
    client_id: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
    project_id: z.union([z.literal(""), z.uuid()]).transform((v) => v || null),
    margins: marginsSchema.default(defaultDocumentOptions.margins),
  })
  .superRefine((input, ctx) => {
    try {
      templateVariables(input.body);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message:
          error instanceof Error ? error.message : "Revisa las variables.",
      });
    }
  });
export const standaloneSnapshotSchema = z.object({
  title: z.string(),
  kind: z.enum(["letter", "official", "minutes", "site_report"]),
  body: z.string(),
  folio: z.string(),
  date: z.string(),
  organization: z.object({ name: z.string() }),
  client: z.object({ name: z.string() }).nullable(),
  project: z.object({ name: z.string() }).nullable(),
  margins: marginsSchema,
});
export type StandaloneSnapshot = z.infer<typeof standaloneSnapshotSchema>;
export type StudioDocument = z.output<typeof standaloneInputSchema> & {
  id: string;
  version: number;
};
export function resolveDocumentBody(snapshot: StandaloneSnapshot) {
  return resolveVariables(snapshot.body, {
    "despacho.nombre": snapshot.organization.name,
    "cliente.nombre": snapshot.client?.name,
    "proyecto.nombre": snapshot.project?.name,
    fecha: snapshot.date,
  });
}
// Reservado para plantillas vinculadas a una versión de cotización; no inventa contexto.
export function quoteTemplateValues(quote: {
  folio: string;
  total_cents: number;
  advance_rate: string;
}) {
  return {
    "cotizacion.folio": quote.folio,
    "cotizacion.total": formatMoney(quote.total_cents),
    "cotizacion.anticipo": formatMoney(
      splitAdvance(quote.total_cents, quote.advance_rate).advance,
    ),
  };
}

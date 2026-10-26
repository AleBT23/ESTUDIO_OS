import { it, expect } from "vitest";
import {
  templateVariables,
  resolveVariables,
  standaloneInputSchema,
  quoteTemplateValues,
} from "@/modules/documents/standalone-schema";
it("variables usan lista blanca y rechazan sintaxis incompleta o acceso a propiedades arbitrarias", () => {
  expect(
    templateVariables(
      "Para {{ cliente.nombre }} · {{fecha}} · {{cliente.nombre}}",
    ),
  ).toEqual(["cliente.nombre", "fecha"]);
  expect(() => templateVariables("{{cliente.__proto__}}")).toThrow(
    "no permitida",
  );
  expect(() => templateVariables("{{cliente.nombre")).toThrow("sin cerrar");
});
it("detiene emisión sin valores necesarios y no expande variables introducidas por un nombre", () => {
  expect(() => resolveVariables("Para {{cliente.nombre}}", {})).toThrow(
    "Faltan datos",
  );
  expect(
    resolveVariables("{{cliente.nombre}}", {
      "cliente.nombre": "María {{fecha}}",
    }),
  ).toBe("María {{fecha}}");
  expect(
    resolveVariables("{{cliente.nombre}} · {{fecha}}", {
      "cliente.nombre": "María Ñúñez",
      fecha: "2026-10-19",
    }),
  ).toBe("María Ñúñez · 2026-10-19");
});
it("un documento independiente puede no tener presupuesto, cliente ni proyecto", () => {
  const parsed = standaloneInputSchema.parse({
    title: "Minuta de coordinación",
    kind: "minutes",
    body: "Acuerdos de la sesión.",
    client_id: "",
    project_id: "",
  });
  expect(parsed.client_id).toBeNull();
  expect(parsed.project_id).toBeNull();
  expect(parsed.margins.bottom).toBeGreaterThanOrEqual(26);
  expect(
    standaloneInputSchema.safeParse({
      ...parsed,
      client_id: "",
      project_id: "",
      body: "{{usuario.password}}",
    }).success,
  ).toBe(false);
});
it("variables de cotización formatean anticipo exacto solo cuando se proporciona un contexto real", () => {
  expect(
    quoteTemplateValues({
      folio: "COT-2026-0001",
      total_cents: 2500000,
      advance_rate: "50",
    }),
  ).toEqual({
    "cotizacion.folio": "COT-2026-0001",
    "cotizacion.total": "$25,000.00",
    "cotizacion.anticipo": "$12,500.00",
  });
});

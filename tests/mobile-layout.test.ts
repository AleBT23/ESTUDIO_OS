import { it, expect, vi } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
vi.mock("next/navigation", () => ({
  usePathname: () => "/comercial/cotizaciones/nueva",
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("@/shared/auth/actions", () => ({ signOut: async () => ({}) }));
vi.mock("@/modules/quotes/actions", () => ({ saveQuote: async () => ({}) }));
vi.mock("@/modules/projects/actions", () => ({
  createProject: async () => ({}),
  defineProjectAmount: async () => ({}),
  saveProjectNote: async () => ({}),
  toggleProjectNote: async () => ({}),
}));
vi.mock("@/modules/projects/photo-actions", () => ({
  prepareObservation: async () => ({}),
  finishObservation: async () => ({}),
  cancelObservation: async () => ({}),
}));
vi.mock("@/modules/finance/actions", () => ({
  recordPayment: async () => ({}),
  reversePayment: async () => ({}),
}));
vi.mock("@/modules/quotes/archive-action", () => ({
  archiveQuote: async () => ({}),
}));
import { Shell } from "@/shared/ui/shell";
import { QuoteEditor } from "@/modules/quotes/quote-editor";
import { NoteForm, NoteRow } from "@/modules/projects/forms";
import { ObservationForm } from "@/modules/projects/observation-form";
import { PaymentForm } from "@/modules/finance/payment-forms";
import { QuoteActions } from "@/modules/quotes/quote-actions";
it("prepara componentes reales para revisión responsive sin simular persistencia", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const quote = h(QuoteEditor, {
    clients: [{ id, name: "Cliente de prueba de composición" }],
    services: [],
    lines: [{ id, name: "Arquitectura" }],
    presets: [],
    concepts: [],
    validUntil: "2026-12-31",
    initial: {
      id,
      version: 1,
      header: {
        client_id: id,
        name: "Prueba de presupuesto desde teléfono",
        vat_rate: "16",
        apply_vat: true,
        advance_rate: "50",
        valid_until: "2026-12-31",
        notes: "Muestra de layout. No crea datos.",
        conditions: "Condiciones de prueba.",
        estimated_hours: "10",
        externalCost: "0.00",
      },
      items: [
        {
          service_id: "",
          business_line_id: id,
          name: "Actualización de plano y revisión de iluminación",
          description:
            "Descripción extensa para verificar controles de captura y adaptación de pantalla.",
          quantity: "2.125",
          unit: "fixed",
          unitPrice: "12500.00",
          discount: "5",
        },
      ],
    },
  });
  const project = h(
    "div",
    { className: "project-stack" },
    h(
      "section",
      { className: "panel padded" },
      h("h1", null, "Notas de proyecto"),
      h(NoteForm, { project: id }),
      h(NoteRow, {
        note: {
          id,
          project_id: id,
          kind: "task",
          body: "Corregir plano de iluminación y revisar ubicación de apagadores",
          due_on: "2026-11-02",
          completed_at: null,
          version: 1,
          created_at: "2026-10-25T12:00:00Z",
        },
        writable: true,
      }),
    ),
    h(
      "section",
      { className: "panel padded" },
      h("h2", null, "Registro fotográfico"),
      h(ObservationForm, { project: id, today: "2026-10-25", requestId: id }),
    ),
    h(PaymentForm, {
      plans: [
        {
          id,
          label: "Anticipo",
          balance_cents: 250000,
          project_name: "Obra de prueba",
        },
      ],
      today: "2026-10-25",
      requestId: id,
    }),
  );
  const dialog = h(
    "section",
    { className: "panel padded" },
    h("h1", null, "Acciones de cotización"),
    h(QuoteActions, {
      id,
      version: 1,
      name: "Propuesta extensa para revisión de confirmación en móvil",
      folio: "COT-PRUEBA",
    }),
  );
  const css = (await readFile("src/app/globals.css", "utf8")).replace(
    '@import "tailwindcss";',
    "",
  );
  await mkdir(".local/layout-fixtures", { recursive: true });
  for (const [name, content] of [
    ["quote", quote],
    ["project", project],
    ["dialog", dialog],
  ] as const) {
    const html = renderToString(
      h(Shell, {
        organization: "Estudio de prueba",
        email: "prueba@example.invalid",
        children: content,
      }),
    );
    expect(html).toContain("contenido");
    await writeFile(
      `.local/layout-fixtures/${name}.html`,
      `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style><body>${html}</body></html>`,
    );
  }
});

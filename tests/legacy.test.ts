import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { describe, it, expect } from "vitest";
import inventory from "./fixtures/legacy-inventory.json";
const base = ".audit/legacy/tabulador de precios v2/";
const available = existsSync(base + "app.js");
// La auditoría extrae código local verificado. No se ejecuta inicialización DOM.
describe.skipIf(!available)(
  "Caracterización del legado original sin modificar",
  () => {
    function context() {
      const values = new Map<string, string>();
      const nodes: Record<
        string,
        {
          textContent: string;
          value?: string;
          checked?: boolean;
          style: Record<string, string>;
        }
      > = {};
      for (const id of [
        "tot-subtotal",
        "tot-discount",
        "tot-vat",
        "tot-grand",
        "vat-row",
      ])
        nodes[id] = { textContent: "", style: {} };
      nodes["chk-apply-vat"] = { textContent: "", checked: true, style: {} };
      const ctx = vm.createContext({
        console,
        document: {
          addEventListener() {},
          getElementById: (id: string) => nodes[id] || null,
        },
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
        },
      });
      for (const name of ["config.js", "storage.js", "pdf.js", "app.js"])
        vm.runInContext(readFileSync(base + name, "utf8"), ctx);
      return { ctx, nodes };
    }
    it("verifica hashes del inventario y RAR", () => {
      for (const file of inventory.files)
        expect(
          createHash("sha256")
            .update(readFileSync(base + file.name))
            .digest("hex"),
        ).toBe(file.sha256);
      expect(
        createHash("sha256")
          .update(readFileSync(inventory.archive.path))
          .digest("hex"),
      ).toBe(inventory.archive.sha256);
    });
    it("IVA 16%, descuento por partida e IVA desactivado", () => {
      const { ctx, nodes } = context();
      vm.runInContext(
        `AppState.settings={vat:16,currency:'MXN'};AppState.proposalItems=[{quantity:2,unitPrice:100,discount:10}];recalcTotals()`,
        ctx,
      );
      expect(nodes["tot-grand"].textContent).toBe("$208.80");
      nodes["chk-apply-vat"].checked = false;
      vm.runInContext("recalcTotals()", ctx);
      expect(nodes["tot-grand"].textContent).toBe("$180.00");
    });
    it("documenta el fallo pct: 8 × 1 millón en vez de 8%", () => {
      const { ctx, nodes } = context();
      vm.runInContext(
        `AppState.settings={vat:0,currency:'MXN'};AppState.proposalItems=[{quantity:1000000,unitPrice:8,unit:'pct',discount:0}];recalcTotals()`,
        ctx,
      );
      expect(nodes["tot-grand"].textContent).toBe("$8,000,000.00");
    });
    it("documenta pérdida de acentos y unidad m²", () => {
      const { ctx } = context();
      expect(
        vm.runInContext(
          `toAsciiSafe('Arquitectura, diseño y Ñúñez · m²')`,
          ctx,
        ),
      ).toBe("Arquitectura, diseno y Nunez  m");
    });
    it("conserva folio y contador global, no reinicia por año", () => {
      const { ctx } = context();
      expect(vm.runInContext("nextProposalNumber()", ctx)).toMatch(
        /^COT-\d{4}-001$/,
      );
      expect(vm.runInContext("nextProposalNumber()", ctx)).toMatch(/-002$/);
    });
    it("editar copia no modifica catálogo ni concepto original", () => {
      const { ctx } = context();
      expect(
        vm.runInContext(
          `upsertLibraryConcept({id:'c',name:'Concepto',text:'Original'});const copy={conceptDescription:loadConceptLibrary()[0].text};copy.conceptDescription='Editado';loadConceptLibrary()[0].text`,
          ctx,
        ),
      ).toBe("Original");
    });
  },
);

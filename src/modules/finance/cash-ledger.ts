import { cashAreas } from "./area-cash";
import { expenseCategories } from "./expense-categories";
import { centsDecimal } from "./work-report";
type Row = {
  id: string;
  source: string;
  paid_on: string;
  concept: string;
  client_name: string | null;
  project_name: string | null;
  work_name: string | null;
  supplier: string | null;
  area: keyof typeof cashAreas;
  managed: boolean;
  direction: string;
  amount: string;
  reference: string | null;
  expense_category: keyof typeof expenseCategories | null;
  reversed: boolean;
  reversed_at: string | null;
  reversal_reason: string | null;
};
export function ledgerCsv(rows: Row[]) {
  const header =
    "ID,Origen,Fecha,Concepto,Cliente,Proyecto,Obra,Proveedor,Área,Fondos,Movimiento,Importe MXN,Flujo efectivo MXN,Referencia,Categoría,Estado,Fecha de reverso,Motivo de reverso";
  const escape = (s: string | null) =>
    '"' +
    (/^\s*[=+@-]/.test(s ?? "") ? "'" : "") +
    (s ?? "").replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((r) =>
        [
          r.id,
          r.source,
          r.paid_on,
          ...[
            r.concept,
            r.client_name,
            r.project_name,
            r.work_name,
            r.supplier,
          ].map(escape),
          cashAreas[r.area],
          r.managed ? "Administrados" : "Propios",
          r.direction === "in" ? "Cobro" : "Pago",
          centsDecimal(r.amount),
          centsDecimal(
            r.reversed ? "0" : r.direction === "in" ? r.amount : "-" + r.amount,
          ),
          escape(r.reference),
          r.expense_category ? expenseCategories[r.expense_category] : "",
          r.reversed ? "Revertido" : "Vigente",
          r.reversed_at ?? "",
          escape(r.reversal_reason),
        ].join(","),
      ),
    ].join("\r\n") +
    "\r\n"
  );
}

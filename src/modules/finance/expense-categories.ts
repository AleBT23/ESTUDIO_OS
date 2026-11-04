import { centsDecimal } from "./work-report";
export const expenseCategories = {
  material: "Materiales",
  labor: "Mano de obra",
  equipment: "Maquinaria y equipo",
  external: "Servicios externos",
  permit: "Permisos y gestorías",
  overhead: "Gastos del despacho",
  other: "Otros",
} as const;
export type ExpenseCategory = keyof typeof expenseCategories;
export const financeAreas = {
  architecture: "Proyecto arquitectónico",
  construction: "Obra",
  service: "Servicio complementario",
} as const;
export type ExpenseGroup = {
  area: keyof typeof financeAreas;
  managed: boolean;
  category: ExpenseCategory | null;
  movements: number;
  paid: string;
};

export function expenseCsv(rows: ExpenseGroup[]) {
  const header = ["Área", "Fondos", "Categoría", "Pagos", "Pagado MXN"];
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((r) => [
        financeAreas[r.area],
        r.managed ? "Del cliente" : "Propios",
        r.category ? expenseCategories[r.category] : "Sin clasificar",
        r.movements,
        centsDecimal(r.paid),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\r\n") +
    "\r\n"
  );
}

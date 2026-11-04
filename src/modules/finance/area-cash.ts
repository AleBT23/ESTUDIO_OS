import { financeAreas } from "./expense-categories";
import { centsDecimal } from "./work-report";
import { cashMargin } from "./productivity-report";
export const cashAreas = {
  ...financeAreas,
  project_plan: "Planes de proyecto sin área atribuida",
};
export type AreaCashRow = {
  area: keyof typeof cashAreas;
  managed: boolean;
  received: string;
  paid: string;
  net: string;
};
export function areaCashCsv(rows: AreaCashRow[]) {
  const header = [
    "Área",
    "Fondos",
    "Cobrado MXN",
    "Pagado MXN",
    "Flujo MXN",
    "Margen sobre cobros (%)",
  ];
  const lines = rows.map((r) => [
    cashAreas[r.area],
    r.managed ? "Del cliente" : "Propios",
    centsDecimal(r.received),
    centsDecimal(r.paid),
    centsDecimal(r.net),
    cashMargin(r) ?? "",
  ]);
  return (
    "\uFEFF" +
    [header, ...lines].map((line) => line.join(",")).join("\r\n") +
    "\r\n"
  );
}

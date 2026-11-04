export const workMetrics = [
  ["revenue_cents", "Ingreso acordado"],
  ["cost_cents", "Costo comprometido"],
  ["received_cents", "Recibido"],
  ["paid_cents", "Pagado"],
  ["receivable_cents", "Por cobrar"],
  ["payable_cents", "Por pagar"],
  ["cash_cents", "Disponible"],
  ["expected_margin_cents", "Margen previsto"],
] as const;
type Metric = (typeof workMetrics)[number][0];
export type WorkBalance = { managed: boolean } & Record<Metric, string | null>;
export function workCsv(rows: WorkBalance[]) {
  const header = ["Fondos", ...workMetrics.map(([, name]) => name + " MXN")];
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((row) => [
        row.managed ? "Administrados" : "Propios",
        ...workMetrics.map(([key]) => {
          const raw = row[key];
          if (raw === null) return "";
          const cents = BigInt(raw),
            abs = cents < 0n ? -cents : cents;
          return (
            (cents < 0n ? "-" : "") +
            (abs / 100n).toString() +
            "." +
            (abs % 100n).toString().padStart(2, "0")
          );
        }),
      ]),
    ]
      .map((line) => line.join(","))
      .join("\r\n") +
    "\r\n"
  );
}

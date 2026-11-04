import { formatMoney } from "@/shared/money";
export type VersionEstimate = {
  revenue: string;
  direct: string;
  external: string;
  hours: string;
  hourly_cost: string | null;
  labor: string | null;
  profit: string;
  margin: string | null;
  items: {
    name: string;
    quantity: string;
    unit: string;
    unit_cost: string | null;
    total_cost: string | null;
  }[];
};
const money = (raw: string | null) =>
  raw === null ? "Sin asignar" : formatMoney(BigInt(raw));
export function HistoricalEstimate({
  value,
}: {
  value: VersionEstimate | null;
}) {
  return (
    <details>
      <summary>Estimación interna de esta versión</summary>
      {!value ? (
        <p>Esta versión es anterior al registro histórico de estimaciones.</p>
      ) : (
        <>
          <dl>
            <dt>Ingreso previsto sin IVA</dt>
            <dd>{money(value.revenue)}</dd>
            <dt>Costos directos</dt>
            <dd>{money(value.direct)}</dd>
            <dt>Otros costos externos</dt>
            <dd>{money(value.external)}</dd>
            <dt>Horas previstas y tarifa interna</dt>
            <dd>
              {value.hours} h · {money(value.hourly_cost)}
            </dd>
            <dt>Costo previsto de horas</dt>
            <dd>{money(value.labor)}</dd>
            <dt>Resultado previsto</dt>
            <dd>{money(value.profit)}</dd>
            <dt>Margen sobre ingreso sin IVA</dt>
            <dd>
              {value.margin === null ? "Sin ingreso" : value.margin + " %"}
            </dd>
          </dl>
          <div className="table-scroll">
            <table>
              <caption>Costos directos de la versión</caption>
              <thead>
                <tr>
                  <th>Partida</th>
                  <th>Cantidad o base</th>
                  <th>Costo unitario o fijo</th>
                  <th>Costo de partida</th>
                </tr>
              </thead>
              <tbody>
                {value.items.map((i, n) => (
                  <tr key={n}>
                    <th>{i.name}</th>
                    <td>{i.quantity}</td>
                    <td>{money(i.unit_cost)}</td>
                    <td>{money(i.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
  );
}

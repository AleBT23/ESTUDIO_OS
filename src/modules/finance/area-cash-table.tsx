import { cashAreas, type AreaCashRow } from "./area-cash";
import { formatMoney } from "@/shared/money";
import { cashMargin } from "./productivity-report";
export function AreaCashTable({
  rows,
  url,
}: {
  rows: AreaCashRow[];
  url: string;
}) {
  return (
    <section className="panel padded">
      <h2>Flujo por área y origen de fondos</h2>
      <p>
        Los cobros de planes de proyecto se muestran por separado cuando carecen
        de área atribuida.
      </p>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Área",
                  "Fondos",
                  "Cobrado",
                  "Pagado",
                  "Flujo",
                  "Margen sobre cobros",
                ].map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.area + String(r.managed)}>
                  <th>{cashAreas[r.area]}</th>
                  <td>{r.managed ? "Del cliente" : "Propios"}</td>
                  {[r.received, r.paid, r.net].map((v, i) => (
                    <td key={i}>{formatMoney(BigInt(v))}</td>
                  ))}
                  <td>{cashMargin(r) === null ? "—" : cashMargin(r) + " %"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Sin movimientos efectivos en la selección.</p>
      )}
      <a className="button button-outline" href={url}>
        Exportar flujo por área CSV
      </a>
    </section>
  );
}

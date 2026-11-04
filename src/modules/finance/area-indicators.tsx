import Link from "next/link";
import { getContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
const labels: Record<string, string> = {
  architecture: "Proyecto arquitectónico",
  construction: "Ejecución de obra",
  service: "Servicios complementarios",
};
const columns = [
  ["received_cents", "Cobrado"],
  ["paid_cents", "Pagado"],
  ["receivable_cents", "Por cobrar"],
  ["payable_cents", "Por pagar"],
  ["cash_cents", "Flujo neto"],
  ["expected_margin_cents", "Margen previsto"],
] as const;
export async function AreaIndicators() {
  const ctx = await getContext();
  if (
    !ctx?.organization ||
    !ctx.membership ||
    !canReadFinance(ctx.membership.role)
  )
    return null;
  const { data, error } = await ctx.db
    .from("finance_area_indicators")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("source")
    .order("area")
    .order("managed");
  return (
    <section className="panel padded">
      <div className="section-heading">
        <h2>Indicadores financieros</h2>
        <Link href="/administracion/reportes">Filtrar y exportar</Link>
        <Link href="/administracion/operaciones">Ver operaciones</Link>
      </div>
      {error ? (
        <p>
          Indicadores no disponibles. Comprueba la conexión y las migraciones
          financieras.
        </p>
      ) : !data.length ? (
        <p>El estudio aún no tiene acuerdos ni planes registrados.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <caption>
              Saldos acumulados en MXN. Los planes históricos solo aportan
              cobros y cartera.
            </caption>
            <thead>
              <tr>
                <th>Área y fondos</th>
                {columns.map(([k, label]) => (
                  <th key={k}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={[row.source, row.area, row.managed].join("-")}>
                  <th scope="row">
                    {row.source === "schedules"
                      ? "Planes históricos de proyectos"
                      : labels[row.area] +
                        " · " +
                        (row.managed ? "Fondos del cliente" : "Fondos propios")}
                  </th>
                  {columns.map(([k]) => (
                    <td key={k}>
                      {row[k] === null ? "—" : formatMoney(BigInt(row[k]))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

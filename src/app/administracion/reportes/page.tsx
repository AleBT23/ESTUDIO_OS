import { TimeCostSummary, type TimeCost } from "@/modules/finance/time-cost-summary";
import {
  expenseCategories,
  financeAreas,
  type ExpenseGroup,
} from "@/modules/finance/expense-categories";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import {
  receivedPerHour,
  reportFilters,
  type ProductivityRow,
} from "@/modules/finance/productivity-report";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p className="notice">Permisos insuficientes.</p>;
  const raw = await searchParams,
    filters = reportFilters.safeParse(raw),
    org = ctx.organization.id;
  const sources = [
    ["customer", "Cliente", "clients"],
    ["project", "Proyecto", "projects"],
    ["work", "Obra", "works"],
    ["package", "Paquete", "project_service_packages"],
    ["line", "Línea", "business_lines"],
  ];
  const [groups, result, expenses, timeCost] = await Promise.all([
    Promise.all(
      sources.map(async ([name, label, table]) => ({
        name,
        label,
        options: await ctx.db
          .from(table)
          .select("id,name")
          .eq("organization_id", org)
          .order("name"),
      })),
    ),
    filters.success
      ? ctx.db.rpc("cash_productivity", { org, ...filters.data })
      : null,
    filters.success
      ? ctx.db.rpc("expense_breakdown", { org, ...filters.data })
      : null,
    filters.success
      ? ctx.db.rpc("time_cost_report", { org, ...filters.data }).maybeSingle<TimeCost>()
      : null,
  ]);
  const rows: ProductivityRow[] = result?.data ?? [];
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">ADMINISTRACIÓN</p>
        <h1>Flujo y productividad</h1>
        <p>
          El flujo por hora divide los cobros menos pagos efectivos entre las
          horas registradas del periodo. Los fondos del cliente se presentan por
          separado. El cobrado por hora divide los cobros efectivos propios
          entre las horas trabajadas.
        </p>
      </header>
      <form className="panel padded">
        <div className="form-grid">
          <label>
            Desde
            <input type="date" name="from_date" defaultValue={raw.from_date} />
          </label>
          <label>
            Hasta
            <input type="date" name="to_date" defaultValue={raw.to_date} />
          </label>
          {groups.map((g) => (
            <label key={g.name}>
              {g.label}
              <select name={g.name} defaultValue={raw[g.name] ?? ""}>
                <option value="">Todos</option>
                {g.options.data?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button className="button button-primary">Aplicar filtros</button>
      </form>
      {groups.some((g) => g.options.error) && (
        <p className="notice">
          Algunas opciones de filtro no se pudieron cargar.
        </p>
      )}
      {!filters.success ? (
        <p className="notice">Revisa las fechas y los filtros seleccionados.</p>
      ) : result?.error ? (
        <p className="notice">No se pudo calcular el reporte.</p>
      ) : (
        <section className="panel padded">
          <h2>Resultados por línea</h2>
          {rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Línea",
                      "Fondos",
                      "Cobrado",
                      "Pagado",
                      "Flujo",
                      "Tiempo",
                      "Flujo por hora",
                      "Cobrado por hora",
                    ].map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const hourly = receivedPerHour(r);
                    return (
                      <tr key={r.line_name + String(r.managed)}>
                        <th>{r.line_name}</th>
                        <td>{r.managed ? "Del cliente" : "Propios"}</td>
                        {[r.received, r.paid, r.net].map((v, i) => (
                          <td key={i}>{formatMoney(BigInt(v))}</td>
                        ))}
                        <td>{r.minutes} min</td>
                        <td>
                          {r.net_hourly === null
                            ? "—"
                            : formatMoney(BigInt(r.net_hourly))}
                        </td>
                        <td>{hourly === null ? "—" : formatMoney(hourly)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin movimientos ni tiempo en el periodo seleccionado.</p>
          )}
          <a
            className="button button-outline"
            href={
              "/api/reportes/productividad?" +
              new URLSearchParams({ ...raw, detalle: "productividad" })
            }
          >
            Exportar resultados CSV
          </a>
        </section>
      )}
      {filters.success &&
        (raw.work ? (
          <p>
            Las horas se registran por proyecto o paquete. Selecciona un
            proyecto sin filtro de obra para consultar su costo interno.
          </p>
        ) : timeCost?.error || !timeCost?.data ? (
          <p>No se pudo calcular el costo de las horas.</p>
        ) : (
          <TimeCostSummary row={timeCost.data} />
        ))}
      {filters.success && (
        <section className="panel padded">
          <h2>Egresos por categoría</h2>
          {!expenses?.error && (
            <a
              className="button button-outline"
              href={
                "/api/reportes/productividad?" +
                new URLSearchParams({ ...raw, detalle: "egresos" })
              }
            >
              Exportar egresos CSV
            </a>
          )}
          {expenses?.error ? (
            <p>No se pudo cargar el desglose de egresos.</p>
          ) : expenses?.data?.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {["Área", "Fondos", "Categoría", "Pagos", "Pagado"].map(
                      (label) => (
                        <th key={label}>{label}</th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(expenses.data as ExpenseGroup[]).map((r) => (
                    <tr key={[r.area, r.managed, r.category].join("/")}>
                      <td>{financeAreas[r.area]}</td>
                      <td>{r.managed ? "Del cliente" : "Propios"}</td>
                      <td>
                        {r.category
                          ? expenseCategories[r.category]
                          : "Sin clasificar"}
                      </td>
                      <td>{r.movements}</td>
                      <td>{formatMoney(BigInt(r.paid))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin egresos efectivos en esta selección.</p>
          )}
        </section>
      )}
    </>
  );
}

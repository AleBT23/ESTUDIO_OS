import {
  PackageExecution,
  type PackageExecutionRow,
} from "./package-execution";
import {
  TimeCostSummary,
  type TimeCost,
} from "@/modules/finance/time-cost-summary";
import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney, marginOnRevenue } from "@/shared/money";
import type { ProductivityRow } from "@/modules/finance/productivity-report";
export async function ProjectPerformance({ project }: { project: string }) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role)) return null;
  const [estimate, flow, timeCost, packages] = await Promise.all([
    ctx.db
      .from("project_quote_estimates")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .eq("project_id", project)
      .maybeSingle(),
    ctx.db.rpc("cash_productivity", { org: ctx.organization.id, project }),
    ctx.db
      .rpc("time_cost_report", { org: ctx.organization.id, project })
      .maybeSingle<TimeCost>(),
    ctx.db.rpc("project_package_execution", {
      org: ctx.organization.id,
      project,
    }),
  ]);
  if (estimate.error || flow.error)
    return (
      <p className="notice">No se pudo cargar la estimación y ejecución.</p>
    );
  const e = estimate.data,
    rows = (flow.data as ProductivityRow[]).filter((r) => !r.managed);
  let received = 0n,
    paid = 0n,
    minutes = 0n;
  for (const r of rows) {
    received += BigInt(r.received);
    paid += BigInt(r.paid);
    minutes += BigInt(r.minutes);
  }
  const margin = marginOnRevenue(received - paid, received);
  const money = (v: string) => formatMoney(BigInt(v));
  return (
    <section id="rendimiento" className="panel padded">
      <h2>Estimación y ejecución del proyecto</h2>
      <h3>Presupuesto aceptado</h3>
      {e ? (
        <>
          <p>
            {e.quote_count} cotizaciones aceptadas, incluidos extras vinculados.
          </p>
          <dl>
            <dt>Honorarios netos sin IVA</dt>
            <dd>{money(e.net_cents)}</dd>
            <dt>Costos directos de partidas</dt>
            <dd>{money(e.direct_cost_cents)}</dd>
            <dt>Otros costos externos previstos</dt>
            <dd>{money(e.external_cost_cents)}</dd>
            <dt>Costo imputado a las horas previstas con tarifa</dt>
            <dd>{money(e.labor_cost_cents)}</dd>
            <dt>Resultado previsto después de los costos registrados</dt>
            <dd>
              {money(e.expected_profit_cents)}{" "}
              {e.margin_percent !== null && " · " + e.margin_percent + " %"}
            </dd>
            <dt>Horas estimadas</dt>
            <dd>{Number(e.estimated_hours)}</dd>
            <dt>Honorarios netos por hora estimada</dt>
            <dd>
              {e.estimated_hourly_cents === null
                ? "Sin horas estimadas"
                : money(e.estimated_hourly_cents)}
            </dd>
          </dl>
          {Number(e.unrated_hours) > 0 && (
            <p>
              {Number(e.unrated_hours)} horas previstas pendientes de tarifa. El
              margen incluye únicamente los costos registrados.
            </p>
          )}
          {Number(e.historical_quotes) > 0 && (
            <p>
              {e.historical_quotes} propuestas anteriores al historial interno
              usan los importes de sus cabeceras aceptadas.
            </p>
          )}
        </>
      ) : (
        <p>Sin cotizaciones aceptadas vinculadas.</p>
      )}
      <h3>Ejecución registrada · fondos propios</h3>
      <dl>
        <dt>Cobros efectivos</dt>
        <dd>{formatMoney(received)}</dd>
        <dt>Pagos efectivos</dt>
        <dd>{formatMoney(paid)}</dd>
        <dt>Flujo acumulado (cobros menos pagos)</dt>
        <dd>{formatMoney(received - paid)}</dd>
        <dt>Margen sobre cobros (flujo ÷ cobros × 100)</dt>
        <dd>{margin === null ? "Sin cobros" : margin + " %"}</dd>
        <dt>Tiempo trabajado</dt>
        <dd>{minutes.toString()} min</dd>
      </dl>
      {timeCost.error || !timeCost.data ? (
        <p>No se pudo calcular el costo de las horas.</p>
      ) : (
        <TimeCostSummary row={timeCost.data} />
      )}
      {packages.error ? (
        <p>No se pudo cargar la ejecución por paquete.</p>
      ) : (
        <PackageExecution
          project={project}
          rows={(packages.data ?? []) as PackageExecutionRow[]}
        />
      )}
      <Link href={"/administracion/reportes?project=" + project}>
        Ver flujo por hora, línea y periodo
      </Link>
    </section>
  );
}

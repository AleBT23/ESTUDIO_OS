import { dashboardFilter } from "./period-filter";
import Link from "next/link";

import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";

import { AreaCashTable } from "@/modules/finance/area-cash-table";
import type { AreaCashRow } from "@/modules/finance/area-cash";

export async function PeriodFlow() {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role)) return null;
  const values = await dashboardFilter();
  const result = await ctx.db.rpc("area_cash_report", {
    org: ctx.organization.id,
    from_date: values.from_date || null,
    to_date: values.to_date || null,
    line: values.line || null,
  });
  const rows: AreaCashRow[] = result.data ?? [];
  return (
    <section className="panel padded">
      <h2>Flujo por periodo y línea</h2>

      {result.error ? (
        <p role="status">No se pudo consultar el flujo del periodo.</p>
      ) : !rows.length ? (
        <p>Sin movimientos efectivos en esta selección.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <caption>Movimientos efectivos del periodo en MXN</caption>
            <thead>
              <tr>
                {["Fondos", "Cobrado", "Pagado", "Flujo"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[false, true].map((managed) => {
                const group = rows.filter((r) => r.managed === managed);
                if (!group.length) return null;
                const received = group.reduce(
                    (s, r) => s + BigInt(r.received),
                    0n,
                  ),
                  paid = group.reduce((s, r) => s + BigInt(r.paid), 0n);
                return (
                  <tr key={String(managed)}>
                    <th scope="row">
                      {managed
                        ? "Administrados para obra"
                        : "Propios del despacho"}
                    </th>
                    <td>{formatMoney(received)}</td>
                    <td>{formatMoney(paid)}</td>
                    <td>{formatMoney(received - paid)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!result.error && rows.length > 0 && (
        <details>
          <summary>Desglosar por área y consultar márgenes</summary>
          <AreaCashTable
            rows={rows}
            url={
              "/api/reportes/productividad?" +
              new URLSearchParams({ ...values, detalle: "areas" })
            }
          />
        </details>
      )}
      <Link href={"/administracion/reportes?" + new URLSearchParams(values)}>
        Abrir reporte detallado con estos filtros
      </Link>
    </section>
  );
}

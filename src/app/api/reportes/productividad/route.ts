import { ledgerCsv } from "@/modules/finance/cash-ledger";
import { areaCashCsv } from "@/modules/finance/area-cash";
import { expenseCsv } from "@/modules/finance/expense-categories";
import { getContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import {
  reportCsv,
  reportFilters,
} from "@/modules/finance/productivity-report";
export async function GET(request: Request) {
  const ctx = await getContext(),
    headers = { "Cache-Control": "private, no-store" };
  if (
    !ctx?.organization ||
    !ctx.membership ||
    !canReadFinance(ctx.membership.role)
  )
    return new Response(null, { status: 403, headers });
  const filters = reportFilters.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!filters.success) return new Response(null, { status: 400, headers });
  const detail = new URL(request.url).searchParams.get("detalle");
  const args = { org: ctx.organization.id, ...filters.data };
  if (detail === "movimientos") {
    const { data, error } = await ctx.db.rpc("cash_ledger_export", args);
    if (error)
      return new Response(
        error.code === "54000"
          ? "Acota los filtros a 5.000 movimientos por archivo."
          : "No se pudo exportar el detalle.",
        { status: error.code === "54000" ? 413 : 503, headers },
      );
    return new Response(ledgerCsv(data), {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="movimientos-financieros.csv"',
      },
    });
  }
  const result = await ctx.db.rpc(
    detail === "areas"
      ? "area_cash_report"
      : detail === "egresos"
        ? "expense_breakdown"
        : "cash_productivity",
    args,
  );
  if (result.error) return new Response(null, { status: 503, headers });
  let csv: string, filename: string;
  switch (detail) {
    case "areas":
      csv = areaCashCsv(result.data);
      filename = "flujo-por-area.csv";
      break;
    case "egresos":
      csv = expenseCsv(result.data);
      filename = "egresos-por-categoria.csv";
      break;
    default:
      csv = reportCsv(result.data);
      filename = "flujo-y-productividad.csv";
  }
  return new Response(csv, {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + filename + '"',
    },
  });
}

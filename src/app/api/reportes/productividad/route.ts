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
  const result = await ctx.db.rpc("cash_productivity", {
    org: ctx.organization.id,
    ...filters.data,
  });
  if (result.error) return new Response(null, { status: 503, headers });
  return new Response(reportCsv(result.data), {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="flujo-y-productividad.csv"',
    },
  });
}

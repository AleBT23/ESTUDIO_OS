import { z } from "zod";
import { getContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import {
  workCsv,
  workItemCsv,
  type WorkItemProgress,
} from "@/modules/finance/work-report";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getContext(),
    { id } = await params;
  const headers = { "Cache-Control": "private, no-store" };
  if (
    !ctx?.organization ||
    !ctx.membership ||
    !canReadFinance(ctx.membership.role)
  )
    return new Response(null, { status: 403, headers });
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers });
  const items = new URL(request.url).searchParams.get("detalle") === "partidas";
  const work = await ctx.db.from("works").select("id")
    .eq("organization_id", ctx.organization.id).eq("id", id).maybeSingle();
  if (work.error) return new Response(null, { status: 503, headers });
  if (!work.data) return new Response(null, { status: 404, headers });
  let csv: string;
  if (items) {
    const rows: WorkItemProgress[] = [];
    let after = "";
    for (;;) {
      let query = ctx.db
        .from("work_item_progress")
        .select("*")
        .eq("organization_id", ctx.organization.id)
        .eq("work_id", id)
        .order("id")
        .limit(250);
      if (after) query = query.gt("id", after);
      const batch = await query;
      if (batch.error) return new Response(null, { status: 503, headers });
      rows.push(...batch.data);
      if (batch.data.length < 250) break;
      after = batch.data[batch.data.length - 1].id;
    }
    csv = workItemCsv(rows);
  } else {
    const balances = await ctx.db.from("work_balances").select("*")
      .eq("organization_id", ctx.organization.id).eq("work_id", id).order("managed");
    if (balances.error) return new Response(null, { status: 503, headers });
    csv = workCsv(balances.data);
  }
  return new Response(csv, {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="' +
        (items ? "partidas-obra-" : "balance-obra-") +
        id +
        '.csv"',
    },
  });
}

import { z } from "zod";
import { getContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { workCsv } from "@/modules/finance/work-report";
export async function GET(
  _: Request,
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
  const [work, balances] = await Promise.all([
    ctx.db
      .from("works")
      .select("id")
      .eq("organization_id", ctx.organization.id)
      .eq("id", id)
      .maybeSingle(),
    ctx.db
      .from("work_balances")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .eq("work_id", id)
      .order("managed"),
  ]);
  if (work.error || balances.error)
    return new Response(null, { status: 503, headers });
  if (!work.data) return new Response(null, { status: 404, headers });
  return new Response(workCsv(balances.data), {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="balance-obra-' + id + '.csv"',
    },
  });
}

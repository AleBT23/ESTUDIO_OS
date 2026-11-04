import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
export default async function Cancellations({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p>Permisos insuficientes.</p>;
  const page = Math.max(
    1,
    Math.min(10000, parseInt((await searchParams).page ?? "1") || 1),
  );
  const { data, error, count } = await ctx.db
    .from("schedule_cancellation_history")
    .select("*", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 30, page * 30 - 1);
  if (error)
    throw new Error("No se pudo consultar el historial de cancelaciones.");
  return (
    <>
      <Link href="/administracion">Volver a planes y cobros</Link>
      <h1>Cancelaciones de saldo</h1>
      <section className="panel padded">
        {data?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Fecha",
                    "Proyecto y concepto",
                    "Programado antes del cambio",
                    "Saldo cancelado",
                    "Motivo",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {new Intl.DateTimeFormat("es-MX", {
                        dateStyle: "medium",
                        timeZone: ctx.organization.timezone,
                      }).format(new Date(r.created_at))}
                    </td>
                    <td>
                      <Link href={"/proyectos/" + r.project_id}>
                        {r.project_name}
                      </Link>
                      <p>{r.label}</p>
                    </td>
                    <td>{formatMoney(BigInt(r.previous_amount))}</td>
                    <td>{formatMoney(BigInt(r.amount_cents))}</td>
                    <td>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Sin cancelaciones en esta página.</p>
        )}
        {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
        {page * 30 < (count ?? 0) && (
          <Link href={"?page=" + (page + 1)}>Siguiente</Link>
        )}
      </section>
    </>
  );
}

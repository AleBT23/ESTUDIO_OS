import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";

export default async function ScheduleChanges({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p className="notice">Permisos insuficientes.</p>;
  const page = Math.max(
    1,
    Math.min(10000, parseInt((await searchParams).page ?? "1") || 1),
  );
  const { data, count, error } = await ctx.db
    .from("schedule_change_history")
    .select(
      "id,schedule_id,result_id,project_id,project_name,label,previous_due,due_on,amount_cents,created_at",
      { count: "exact" },
    )
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 30, page * 30 - 1);
  const dates = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ctx.organization.timezone,
  });
  return (
    <>
      <Link href="/administracion">Volver a planes y cobros</Link>
      <header className="page-heading">
        <h1>Historial de reprogramaciones</h1>
        <p>
          Cambios de vencimiento y parcialidades de los proyectos del estudio.
        </p>
      </header>
      <section className="panel padded">
        {error ? (
          <p>No se pudo cargar el historial.</p>
        ) : (
          <>
            {data.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Registrado",
                        "Proyecto y concepto",
                        "Cambio",
                        "Fecha anterior",
                        "Nueva fecha",
                        "Importe",
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.id}>
                        <td>{dates.format(new Date(row.created_at))}</td>
                        <td>
                          <Link href={"/proyectos/" + row.project_id}>
                            {row.project_name}
                          </Link>
                          <p>{row.label}</p>
                        </td>
                        <td>
                          {row.schedule_id === row.result_id
                            ? "Cambio de fecha"
                            : "Nueva parcialidad"}
                        </td>
                        <td>{row.previous_due}</td>
                        <td>{row.due_on}</td>
                        <td>{formatMoney(BigInt(row.amount_cents))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Sin reprogramaciones en esta página.</p>
            )}
            {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
            {page * 30 < (count ?? 0) && (
              <Link href={"?page=" + (page + 1)}>Siguiente</Link>
            )}
          </>
        )}
      </section>
    </>
  );
}

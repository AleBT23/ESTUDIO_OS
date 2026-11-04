import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { PeriodFilter, dashboardFilter } from "./period-filter";
const labels = {
  project: "Proyectos activos",
  task: "Tareas vencidas",
  delivery: "Entregas en los próximos siete días",
  quote: "Cotizaciones enviadas",
};
type Kind = keyof typeof labels;
const href = (kind: Kind, page = 1) =>
  "/?" +
  new URLSearchParams({ indicador: kind, detalle: String(page) }) +
  "#detalle-indicador";
export async function PeriodIndicators({
  selected,
  page,
}: {
  selected?: string;
  page: number;
}) {
  const ctx = await requireContext(),
    values = await dashboardFilter(),
    args = {
      org: ctx.organization.id,
      from_date: values.from_date || null,
      to_date: values.to_date || null,
      line: values.line || null,
    };
  const keys = (Object.keys(labels) as Kind[]).filter(
    (k) => k !== "quote" || canManageCommercial(ctx.membership.role),
  );
  const kind = keys.find((k) => k === selected);
  const [counts, detail] = await Promise.all([
    ctx.db.rpc("dashboard_period_counts", args),
    kind
      ? ctx.db
          .rpc("dashboard_period_items", args)
          .eq("kind", kind)
          .order("event_on")
          .order("id")
          .range((page - 1) * 25, page * 25)
      : null,
  ]);
  const totals = new Map<string, number>(
    (counts.data ?? []).map((r: { kind: string; total: number }) => [
      r.kind,
      r.total,
    ]),
  );
  return (
    <>
      <PeriodFilter values={values} lines={ctx.lines} />
      <div className="overview-grid">
        {keys.map((k) => (
          <Link className="panel overview-card" key={k} href={href(k)}>
            <h2>{labels[k]}</h2>
            <strong>
              {counts.error ? "Consulta no disponible" : (totals.get(k) ?? 0)}
            </strong>
          </Link>
        ))}
      </div>
      {kind && (
        <section className="panel padded" id="detalle-indicador">
          <h2>{labels[kind]} · detalle del filtro</h2>
          {detail?.error ? (
            <p role="status">No se pudo consultar el detalle.</p>
          ) : !detail?.data?.length ? (
            <p>Sin registros en esta página.</p>
          ) : (
            <ul>
              {detail.data
                .slice(0, 25)
                .map(
                  (r: {
                    id: string;
                    project_id: string | null;
                    label: string;
                    event_on: string;
                  }) => (
                    <li key={r.id}>
                      <Link
                        href={
                          kind === "quote"
                            ? "/comercial/cotizaciones/" + r.id
                            : "/proyectos/" + r.project_id
                        }
                      >
                        {r.label}
                      </Link>{" "}
                      · {r.event_on}
                    </li>
                  ),
                )}
            </ul>
          )}
          <nav aria-label="Páginas del indicador">
            {page > 1 && <Link href={href(kind, page - 1)}>Anterior</Link>}{" "}
            {(detail?.data?.length ?? 0) > 25 && (
              <Link href={href(kind, page + 1)}>Siguiente</Link>
            )}
          </nav>
        </section>
      )}
    </>
  );
}

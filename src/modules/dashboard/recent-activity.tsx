import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
const areas: Record<string, [string, string]> = {
  quote: ["Cotización", "/comercial/cotizaciones/"],
  delivery: ["Entregable", "/proyectos/"],
  payment: ["Cobro de proyecto", "/proyectos/"],
  operation: ["Movimiento financiero", "/administracion/operaciones/"],
  library: ["Biblioteca", "/recursos/biblioteca?resource="],
};
const actions: Record<string, string> = {
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
  draft: "En revisión",
  review: "En revisión",
  changes: "Con observaciones",
  approved: "Aprobado",
  received: "Entrada registrada",
  paid: "Salida registrada",
  reversed: "Reverso registrado",
  revision: "Versión publicada",
};
export async function RecentActivity({ page }: { page: number }) {
  const ctx = await requireContext();
  const { data, error, count } = await ctx.db
    .from("studio_activity")
    .select("id,source,action,occurred_at,target_id,label", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .order("occurred_at", { ascending: false })
    .order("source")
    .order("id")
    .order("action")
    .range((page - 1) * 12, page * 12 - 1);
  const format = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: ctx.organization.timezone,
  });
  return (
    <section className="panel padded" id="actividad">
      <h2>Actividad reciente</h2>
      {error ? (
        <p>Actividad no disponible.</p>
      ) : (
        <>
          {!data.length && <p>Sin actividad en esta página.</p>}
          {data.map((e) => (
            <article
              key={[e.source, e.id, e.action].join("/")}
              className="activity-row"
            >
              <small>
                <time dateTime={e.occurred_at}>
                  {format.format(new Date(e.occurred_at))}
                </time>{" "}
                · {areas[e.source][0]} · {actions[e.action] ?? e.action}
              </small>
              <Link href={areas[e.source][1] + e.target_id}>{e.label}</Link>
            </article>
          ))}
          {page > 1 && (
            <Link href={"?activityPage=" + (page - 1) + "#actividad"}>
              Más reciente{" "}
            </Link>
          )}
          {(count || 0) > page * 12 && (
            <Link href={"?activityPage=" + (page + 1) + "#actividad"}>
              Anterior
            </Link>
          )}
        </>
      )}
    </section>
  );
}

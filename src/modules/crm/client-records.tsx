import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
const paths = {
  project: "/proyectos/",
  quote: "/comercial/cotizaciones/",
  work: "/obras?obra=",
};
const labels = { project: "Proyecto", quote: "Cotización", work: "Obra" };
const statuses: Record<string, string> = {
  active: "Activo",
  paused: "Pausado",
  closed: "Cerrado",
  archived: "Archivado",
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Vencida",
};
export async function ClientRecords({
  id,
  selected,
  page,
}: {
  id: string;
  selected?: string;
  page: number;
}) {
  const ctx = await requireContext(),
    manager = canManageCommercial(ctx.membership.role);
  const kinds = (
    manager ? ["project", "quote", "work"] : ["project"]
  ) as (keyof typeof labels)[];
  const kind = kinds.find((k) => k === selected);
  let query = ctx.db
    .from("client_related_records")
    .select("kind,id,name,status", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .eq("client_id", id);
  if (kind) query = query.eq("kind", kind);
  const { data, error, count } = await query
    .order("name")
    .order("kind")
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  const href = (n: number, k?: string) =>
    "?" +
    new URLSearchParams({ relacion: k ?? "", vinculos: String(n) }) +
    "#vinculos";
  return (
    <section id="vinculos" className="panel padded">
      <h2>Expedientes vinculados</h2>
      {manager && (
        <nav className="tabs" aria-label="Tipo de expediente">
          <Link href={href(1)} aria-current={!kind ? "page" : undefined}>
            Todos
          </Link>
          {kinds.map((k) => (
            <Link
              key={k}
              href={href(1, k)}
              aria-current={kind === k ? "page" : undefined}
            >
              {labels[k]}
            </Link>
          ))}
        </nav>
      )}
      {error ? (
        <p>No se pudieron consultar los vínculos del cliente.</p>
      ) : (
        <>
          {data.length ? (
            <ul>
              {data.map((row) => {
                const k = row.kind as keyof typeof labels;
                return (
                  <li key={k + row.id}>
                    <Link href={paths[k] + row.id}>{row.name}</Link> ·{" "}
                    {labels[k]}
                    {row.status
                      ? " · " + (statuses[row.status] ?? row.status)
                      : ""}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>Sin expedientes en esta selección.</p>
          )}
          {page > 1 && <Link href={href(page - 1, kind)}>Anterior </Link>}
          {page * 20 < (count ?? 0) && (
            <Link href={href(page + 1, kind)}>Siguiente</Link>
          )}
        </>
      )}
    </section>
  );
}

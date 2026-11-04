import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { eventHref, kinds } from "@/modules/projects/agenda-event";
import { markNotification } from "@/modules/projects/notification-action";
export default async function Notifications({
  searchParams,
}: {
  searchParams: Promise<{ read?: string; page?: string }>;
}) {
  const ctx = await requireContext(),
    q = await searchParams,
    read = q.read === "1",
    page = Math.min(10000, Math.max(1, parseInt(q.page || "1") || 1));
  let query = ctx.db
    .from("agenda_notifications")
    .select("id,kind,label,project_id,due_on,read_at", { count: "exact" })
    .eq("organization_id", ctx.organization.id);
  query = read ? query.not("read_at", "is", null) : query.is("read_at", null);
  const result = await query
    .order("due_on")
    .order("kind")
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  const href = (p: number) => "?read=" + (read ? "1" : "0") + "&page=" + p;
  return (
    <>
      <Link href="/agenda">Agenda del estudio</Link>
      <h1>Notificaciones internas</h1>
      <p>
        Avisos de hoy y vencidos. Marcar un aviso como leído solo cambia tu
        bandeja.
      </p>
      <nav className="tabs">
        <Link href="?read=0" aria-current={!read ? "page" : undefined}>
          Sin leer
        </Link>
        <Link href="?read=1" aria-current={read ? "page" : undefined}>
          Leídos
        </Link>
      </nav>
      {result.error ? (
        <p className="notice">No se pudieron cargar las notificaciones.</p>
      ) : (
        <section className="panel padded">
          {!result.data.length && <p>Sin avisos en esta vista.</p>}
          {result.data.map((e) => (
            <article key={e.kind + e.id}>
              <p>
                {e.due_on} · {kinds[e.kind]}
              </p>
              <Link href={eventHref(e)}>{e.label}</Link>
              <form action={markNotification}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="kind" value={e.kind} />
                <input type="hidden" name="due_on" value={e.due_on} />
                <button
                  className="button button-outline"
                  name="intent"
                  value={read ? "unread" : "read"}
                >
                  {read ? "Marcar sin leer" : "Marcar como leído"}
                </button>
              </form>
            </article>
          ))}
          {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
          {page * 25 < (result.count || 0) && (
            <Link href={href(page + 1)}>Siguiente</Link>
          )}
        </section>
      )}
    </>
  );
}

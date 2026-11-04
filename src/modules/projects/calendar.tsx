import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
const weekday = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const kinds: Record<string, string> = {
  task: "Pendiente",
  collection: "Cobro pendiente",
  delivery: "Entrega",
};
export async function StudioCalendar({
  date,
  page,
}: {
  date: string;
  page: number;
}) {
  const ctx = await requireContext(),
    org = ctx.organization.id;
  const first = new Date(date.slice(0, 7) + "-01T12:00:00Z"),
    next = new Date(first),
    prev = new Date(first);
  next.setUTCMonth(next.getUTCMonth() + 1);
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const href = (day: string, p = 1) =>
    "?view=calendar&date=" + day + "&page=" + p;
  const [counts, events] = await Promise.all([
    ctx.db
      .from("agenda_daily_counts")
      .select("due_on,item_count")
      .eq("organization_id", org)
      .gte("due_on", iso(first))
      .lt("due_on", iso(next)),
    ctx.db
      .from("agenda_events")
      .select("id,project_id,kind,label", { count: "exact" })
      .eq("organization_id", org)
      .eq("due_on", date)
      .order("kind")
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
  ]);
  if (counts.error || events.error)
    return <p className="notice">No se pudo consultar el calendario.</p>;
  const totals = new Map(counts.data.map((r) => [r.due_on, r.item_count]));
  const slots: (string | null)[] = Array((first.getUTCDay() + 6) % 7).fill(
    null,
  );
  for (const d = new Date(first); d < next; d.setUTCDate(d.getUTCDate() + 1))
    slots.push(iso(d));
  return (
    <section className="panel padded">
      <div className="section-heading">
        <Link href={href(iso(prev))}>Mes anterior</Link>
        <h2>
          {new Intl.DateTimeFormat("es-MX", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(first)}
        </h2>
        <Link href={href(iso(next))}>Mes siguiente</Link>
      </div>
      <div className="month-calendar">
        {weekday.map((w) => (
          <strong key={w}>{w}</strong>
        ))}
        {slots.map((day, i) =>
          day ? (
            <Link
              key={day}
              href={href(day)}
              className="calendar-day"
              aria-current={day === date ? "date" : undefined}
              aria-label={day + " · " + (totals.get(day) ?? 0) + " eventos"}
            >
              <span>{Number(day.slice(-2))}</span>
              {totals.has(day) && <small>{totals.get(day)}</small>}
            </Link>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      <h3>Agenda del {date}</h3>
      {events.data.length ? (
        events.data.map((e) => (
          <article key={e.kind + e.id} className="activity-row">
            <small>{kinds[e.kind]}</small>
            <Link href={"/proyectos/" + e.project_id}>{e.label}</Link>
          </article>
        ))
      ) : (
        <p>Sin pendientes para esta fecha.</p>
      )}
      {page > 1 && <Link href={href(date, page - 1)}>Anterior </Link>}
      {page * 30 < (events.count ?? 0) && (
        <Link href={href(date, page + 1)}>Siguiente</Link>
      )}
    </section>
  );
}

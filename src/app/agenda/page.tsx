import { AgendaDeadlines, StudioCalendar } from "@/modules/projects/calendar";
import Link from "next/link";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { DashboardTasks } from "@/modules/projects/workspace";
const views = {
  calendar: "Calendario",
  today: "Hoy",
  week: "Próximos siete días",
  mine: "Asignados a mí",
  high: "Prioridad alta",
  overdue: "Vencidos",
  all: "Lista",
  completed: "Completados",
  date: "Por fecha",
};
export default async function Agenda({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    page?: string;
    date?: string;
    events?: string;
  }>;
}) {
  const ctx = await requireContext();
  const q = await searchParams;
  const view = q.view && Object.hasOwn(views, q.view) ? q.view : "today";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.organization.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = z.iso.date().safeParse(q.date).success ? q.date : today;
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">INICIO</p>
        <h1>Agenda del estudio</h1>
        <Link href="/agenda/notificaciones">Mis notificaciones</Link>
        <p>
          Seguimiento de los pendientes de proyecto en la zona horaria del
          estudio.
        </p>
      </header>
      <nav className="tabs" aria-label="Vistas de agenda">
        {Object.entries(views).map(([k, label]) => (
          <Link
            key={k}
            href={"?view=" + k}
            aria-current={view === k ? "page" : undefined}
            className={view === k ? "selected" : ""}
          >
            {label}
          </Link>
        ))}
      </nav>
      {view === "date" && (
        <form className="form-actions">
          <input type="hidden" name="view" value="date" />
          <label>
            Fecha del calendario
            <input type="date" name="date" required defaultValue={date} />
          </label>
          <button className="button button-outline">Ver fecha</button>
        </form>
      )}
      {["today", "week", "date", "overdue", "all"].includes(view) && (
        <AgendaDeadlines
          view={view}
          date={view === "date" ? (date ?? today) : today}
          page={Math.max(1, Math.min(10000, parseInt(q.events || "1") || 1))}
        />
      )}
      {view === "calendar" ? (
        <StudioCalendar
          date={date ?? today}
          page={Math.max(1, Math.min(10000, parseInt(q.page ?? "1") || 1))}
        />
      ) : (
        <DashboardTasks
          page={Math.max(1, Math.min(10000, parseInt(q.page ?? "1") || 1))}
          view={view}
          date={view === "date" ? date : undefined}
        />
      )}
    </>
  );
}

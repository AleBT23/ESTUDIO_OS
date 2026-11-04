import { canWriteProject, canReadFinance } from "@/shared/permissions";
import { TaskBoard } from "@/modules/projects/task-board";
import { studioToday } from "@/modules/projects/agenda-window";
import { AgendaDeadlines, StudioCalendar } from "@/modules/projects/calendar";
import Link from "next/link";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { DashboardTasks } from "@/modules/projects/workspace";
const views = {
  board: "Tablero Kanban",
  calendar: "Calendario",
  today: "Hoy",
  week: "Próximos siete días",
  mine: "Asignados a mí",
  lateTasks: "Tareas vencidas",
  deliveries: "Próximas entregas",
  receivables: "Por cobrar",
  payables: "Por pagar",
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
    pending?: string;
    working?: string;
    done?: string;
  }>;
}) {
  const ctx = await requireContext();
  const q = await searchParams;
  const visibleViews = Object.entries(views).filter(
    ([key]) =>
      !["receivables", "payables"].includes(key) ||
      canReadFinance(ctx.membership.role),
  );
  const view =
    q.view && visibleViews.some(([key]) => key === q.view) ? q.view : "today";
  const today = studioToday(ctx.organization.timezone);
  const date = z.iso.date().safeParse(q.date).success ? q.date : today;
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">INICIO</p>
        <h1>Agenda del estudio</h1>
        {canWriteProject(ctx.membership.role) && (
          <Link href="/agenda/recordatorios">Mis recordatorios</Link>
        )}
        <Link href="/agenda/notificaciones">Mis notificaciones</Link>
        <p>
          Seguimiento de los pendientes de proyecto en la zona horaria del
          estudio.
        </p>
      </header>
      <nav className="tabs" aria-label="Vistas de agenda">
        {visibleViews.map(([k, label]) => (
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
      {[
        "today",
        "week",
        "date",
        "overdue",
        "all",
        "deliveries",
        "receivables",
        "payables",
      ].includes(view) && (
        <AgendaDeadlines
          view={view}
          date={view === "date" ? (date ?? today) : today}
          page={Math.max(1, Math.min(10000, parseInt(q.events || "1") || 1))}
        />
      )}
      {view === "board" ? (
        <TaskBoard pages={q} />
      ) : view === "calendar" ? (
        <StudioCalendar
          date={date ?? today}
          page={Math.max(1, Math.min(10000, parseInt(q.page ?? "1") || 1))}
        />
      ) : (
        !["deliveries", "receivables", "payables"].includes(view) && (
          <DashboardTasks
            page={Math.max(1, Math.min(10000, parseInt(q.page ?? "1") || 1))}
            view={view}
            date={view === "date" ? date : undefined}
          />
        )
      )}
    </>
  );
}

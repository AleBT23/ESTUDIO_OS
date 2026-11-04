import Link from "next/link";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { saveReminder } from "@/modules/projects/reminder-action";
import { studioToday } from "@/modules/projects/agenda-window";

const priorities = { low: "Baja", normal: "Normal", high: "Alta" } as const;
type Reminder = {
  id: string;
  label: string;
  due_on: string;
  repeat_days: number;
  version: number;
  completed: boolean;
  priority: keyof typeof priorities;
  repeat_months: number;
};
function Editor({ item, today }: { item?: Reminder; today: string }) {
  return (
    <RecordForm id={item?.id ?? crypto.randomUUID()} save={saveReminder}>
      <input type="hidden" name="version" value={item?.version ?? 0} />
      <input type="hidden" name="intent" value="save" />
      <label>
        Asunto
        <input
          name="label"
          required
          minLength={2}
          maxLength={240}
          defaultValue={item?.label}
        />
      </label>
      <label>
        Fecha
        <input
          name="due_on"
          type="date"
          required
          defaultValue={item?.due_on ?? today}
        />
      </label>
      <label>
        Prioridad
        <select name="priority" defaultValue={item?.priority ?? "normal"}>
          {Object.entries(priorities).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Unidad de repetición
        <select
          name="unit"
          defaultValue={item?.repeat_months ? "months" : "days"}
        >
          <option value="days">Días</option>
          <option value="months">Meses de calendario</option>
        </select>
      </label>
      <label>
        Repetir cada (0 días para una sola vez)
        <input
          name="repeat_days"
          type="number"
          min="0"
          max="365"
          step="1"
          required
          defaultValue={item?.repeat_months || item?.repeat_days || 0}
        />
      </label>
    </RecordForm>
  );
}
export default async function Reminders({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    page?: string;
    done?: string;
    prioridad?: string;
  }>;
}) {
  const ctx = await requireContext();
  if (!canWriteProject(ctx.membership.role))
    return <p>Permisos insuficientes.</p>;
  const q = await searchParams,
    done = q.done === "1",
    priority = Object.hasOwn(priorities, q.prioridad ?? "")
      ? q.prioridad
      : undefined,
    page = Math.max(1, Math.min(10000, parseInt(q.page ?? "1") || 1));
  let query = ctx.db
    .from("personal_reminders")
    .select(
      "id,label,due_on,repeat_days,repeat_months,priority,version,completed",
      { count: "exact" },
    )
    .eq("organization_id", ctx.organization.id)
    .eq("user_id", ctx.user.id);
  if (q.id && !z.uuid().safeParse(q.id).success)
    return <p>Identificador inválido.</p>;
  query = q.id ? query.eq("id", q.id) : query.eq("completed", done);
  if (priority && !q.id) query = query.eq("priority", priority);
  const result = await query
    .order("due_on")
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  const today = studioToday(ctx.organization.timezone);
  const href = (p: number) =>
    "?done=" +
    (done ? "1" : "0") +
    "&page=" +
    p +
    (priority ? "&prioridad=" + priority : "");
  return (
    <>
      <Link href="/agenda">Volver a la agenda</Link>
      <header className="page-heading">
        <h1>Mis recordatorios</h1>
        <p>
          Solo tú puedes verlos. Al completar uno recurrente, la siguiente fecha
          se calcula desde su vencimiento.
        </p>
      </header>
      <details>
        <summary>Nuevo recordatorio</summary>
        <Editor today={today} />
      </details>
      <nav className="tabs">
        <Link href="?done=0">Pendientes</Link>
        <Link href="?done=1">Completados</Link>
      </nav>
      {!q.id && (
        <form className="form-actions">
          <input type="hidden" name="done" value={done ? "1" : "0"} />
          <label>
            Filtrar por prioridad
            <select name="prioridad" defaultValue={priority ?? ""}>
              <option value="">Todas</option>
              {Object.entries(priorities).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-outline">Filtrar</button>
        </form>
      )}
      {result.error ? (
        <p>No se pudieron consultar tus recordatorios.</p>
      ) : (
        <section className="panel padded">
          {!result.data.length && <p>Sin recordatorios en esta selección.</p>}
          {result.data.map((r: Reminder) => (
            <article key={r.id}>
              <h2>{r.label}</h2>
              <p>
                {r.due_on} · Prioridad {priorities[r.priority]} ·{" "}
                {r.completed ? "Completado" : "Pendiente"}
                {r.repeat_months > 0
                  ? " · Cada " +
                    r.repeat_months +
                    (r.repeat_months === 1 ? " mes" : " meses")
                  : r.repeat_days > 0
                    ? " · Cada " + r.repeat_days + " días"
                    : ""}
              </p>
              {!r.completed && (
                <>
                  <details>
                    <summary>Editar o reprogramar</summary>
                    <Editor key={r.version} item={r} today={today} />
                  </details>
                  <RecordForm
                    id={r.id}
                    save={saveReminder}
                    submitLabel="Completar recordatorio"
                  >
                    <input type="hidden" name="version" value={r.version} />
                    <input type="hidden" name="intent" value="complete" />
                  </RecordForm>
                </>
              )}
            </article>
          ))}
          {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
          {page * 25 < (result.count ?? 0) && (
            <Link href={href(page + 1)}>Siguiente</Link>
          )}
        </section>
      )}
    </>
  );
}

export const metadata = { title: "Mis recordatorios" };

import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { saveTime } from "./time-action";
type Entry = {
  id: string;
  user_id: string;
  version: number;
  minutes: number;
  worked_on: string;
  description: string;
  package_id: string | null;
  task_id: string | null;
};
export async function TimePanel({
  project,
  page,
}: {
  project: string;
  page: number;
}) {
  const ctx = await requireContext();
  if (!canWriteProject(ctx.membership.role)) return null;
  const org = ctx.organization.id;
  const [rows, packs, tasks] = await Promise.all([
    ctx.db
      .from("project_time")
      .select(
        "id,user_id,version,minutes,worked_on,description,package_id,task_id",
        { count: "exact" },
      )
      .eq("organization_id", org)
      .eq("project_id", project)
      .order("worked_on", { ascending: false })
      .order("id")
      .range((page - 1) * 20, page * 20 - 1),
    ctx.db
      .from("project_service_packages")
      .select("id,name")
      .eq("organization_id", org)
      .eq("project_id", project)
      .is("deleted_at", null)
      .order("name"),
    ctx.db
      .from("project_notes")
      .select("id,body")
      .eq("organization_id", org)
      .eq("project_id", project)
      .eq("kind", "task")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (rows.error || packs.error || tasks.error)
    return (
      <p className="notice">No se pudo consultar el registro de tiempo.</p>
    );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.organization.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const form = (entry?: Entry) => (
    <RecordForm id={entry?.id ?? crypto.randomUUID()} save={saveTime}>
      <input type="hidden" name="project_id" value={project} />
      {entry && <input type="hidden" name="version" value={entry.version} />}
      <label>
        Fecha
        <input
          type="date"
          name="worked_on"
          defaultValue={entry?.worked_on ?? today}
          required
        />
      </label>
      <label>
        Minutos trabajados
        <input
          name="minutes"
          type="number"
          min="1"
          max="1440"
          defaultValue={entry?.minutes}
          required
        />
      </label>
      <label>
        Paquete de servicios
        <select name="package_id" defaultValue={entry?.package_id ?? ""}>
          <option value="">Sin asignar</option>
          {entry?.package_id &&
            !packs.data.some((p) => p.id === entry.package_id) && (
              <option value={entry.package_id}>
                Paquete vinculado · revisa su disponibilidad
              </option>
            )}
          {packs.data.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tarea
        <select name="task_id" defaultValue={entry?.task_id ?? ""}>
          <option value="">Sin asignar</option>
          {entry?.task_id &&
            !tasks.data.some((t) => t.id === entry.task_id) && (
              <option value={entry.task_id}>
                Tarea vinculada · revisa su disponibilidad
              </option>
            )}
          {tasks.data.map((t) => (
            <option key={t.id} value={t.id}>
              {t.body.slice(0, 100)}
            </option>
          ))}
        </select>
      </label>
      <label className="full">
        Actividad
        <textarea
          name="description"
          required
          maxLength={1000}
          defaultValue={entry?.description}
        />
      </label>
    </RecordForm>
  );
  return (
    <section className="panel padded" id="tiempo">
      <h2>Tiempo de trabajo</h2>
      <details>
        <summary>Registrar mi tiempo</summary>
        {form()}
      </details>
      {rows.data.length ? (
        rows.data.map((r) => (
          <article className="activity-row" key={r.id + ":" + r.version}>
            <strong>
              {r.worked_on} · {r.minutes} min ·{" "}
              {r.user_id === ctx.user.id
                ? "Mi cuenta"
                : "Miembro " + r.user_id.slice(0, 8)}
            </strong>
            <p>{r.description}</p>
            <small>
              {packs.data.find((p) => p.id === r.package_id)?.name ??
                (r.package_id ? "Paquete vinculado" : "Sin paquete")}{" "}
              ·{" "}
              {tasks.data.find((t) => t.id === r.task_id)?.body.slice(0, 100) ??
                (r.task_id ? "Tarea vinculada" : "Sin tarea")}{" "}
              · Versión {r.version}
            </small>
            <Link href={"/proyectos/" + project + "/tiempo/" + r.id}>
              Historial de correcciones
            </Link>
            <details>
              <summary>Corregir registro</summary>
              {form(r)}
            </details>
          </article>
        ))
      ) : (
        <p>Sin registros de tiempo en esta página.</p>
      )}
      {page > 1 && (
        <Link href={"?tiempo=" + (page - 1) + "#tiempo"}>Anterior </Link>
      )}
      {page * 20 < (rows.count ?? 0) && (
        <Link href={"?tiempo=" + (page + 1) + "#tiempo"}>Siguiente</Link>
      )}
    </section>
  );
}

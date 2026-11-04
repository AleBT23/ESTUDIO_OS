import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { moveTask } from "./board-action";
const lanes = {
  pending: "Pendientes",
  working: "En curso",
  done: "Completadas",
};
type Lane = keyof typeof lanes;
export async function TaskBoard({
  pages,
}: {
  pages: Partial<Record<Lane, string>>;
}) {
  const ctx = await requireContext(),
    keys = Object.keys(lanes) as Lane[];
  const groups = await Promise.all(
    keys.map(async (lane) => {
      const page = Math.max(
        1,
        Math.min(10000, parseInt(pages[lane] || "1") || 1),
      );
      const result = await ctx.db
        .from("project_task_board")
        .select("id,project_id,project_name,body,due_on,version,priority", {
          count: "exact",
        })
        .eq("organization_id", ctx.organization.id)
        .eq("lane", lane)
        .order("due_on", { nullsFirst: false })
        .order("id")
        .range((page - 1) * 15, page * 15 - 1);
      return { lane, page, result };
    }),
  );
  const href = (lane: Lane, page: number) =>
    "?" +
    new URLSearchParams({
      view: "board",
      ...Object.fromEntries(
        groups.map((g) => [g.lane, String(g.lane === lane ? page : g.page)]),
      ),
    }) +
    "#board-" +
    lane;
  return (
    <div className="overview-grid">
      {groups.map(({ lane, page, result }) => (
        <section className="panel padded" key={lane} id={"board-" + lane}>
          <h2>
            {lanes[lane]} {result.count ?? ""}
          </h2>
          {result.error ? (
            <p>Columna no disponible.</p>
          ) : (
            <>
              {!result.data.length && <p>Sin tareas en esta página.</p>}
              {result.data.map((t) => (
                <article key={t.id + ":" + t.version}>
                  <Link href={"/proyectos/" + t.project_id + "#pendientes"}>
                    {t.project_name}
                  </Link>
                  <p className="note-body">{t.body}</p>
                  <small>
                    {t.due_on ?? "Sin fecha"} · Prioridad{" "}
                    {t.priority === "high"
                      ? "alta"
                      : t.priority === "low"
                        ? "baja"
                        : "normal"}
                  </small>
                  {canWriteProject(ctx.membership.role) && (
                    <RecordForm id={t.id} save={moveTask}>
                      <input
                        type="hidden"
                        name="project"
                        value={t.project_id}
                      />
                      <input type="hidden" name="version" value={t.version} />
                      <label>
                        Mover a
                        <select name="lane">
                          {keys
                            .filter((k) => k !== lane)
                            .map((k) => (
                              <option key={k} value={k}>
                                {lanes[k]}
                              </option>
                            ))}
                        </select>
                      </label>
                    </RecordForm>
                  )}
                </article>
              ))}
              {page > 1 && <Link href={href(lane, page - 1)}>Anterior </Link>}
              {page * 15 < (result.count || 0) && (
                <Link href={href(lane, page + 1)}>Siguiente</Link>
              )}
            </>
          )}
        </section>
      ))}
    </div>
  );
}

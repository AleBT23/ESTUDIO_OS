import Link from "next/link";
import { requireContext, getContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
import { NoteForm, NoteRow } from "./forms";
import { ObservationForm } from "./observation-form";
import type { ProjectNote } from "./schema";
import { projectWorkspaceReady } from "./availability";
export async function DashboardTasks({ page = 1 }: { page?: number }) {
  const ctx = await getContext();
  if (!ctx?.organization || !ctx.membership) return null;
  if (!(await projectWorkspaceReady()))
    return (
      <p className="notice">
        Los pendientes del estudio estarán disponibles al activar esta
        actualización.
      </p>
    );
  const { data, error, count } = await ctx.db
    .from("project_notes_context")
    .select(
      "id,project_id,project_name,kind,body,due_on,completed_at,version,created_at",
      { count: "exact" },
    )
    .eq("organization_id", ctx.organization.id)
    .eq("kind", "task")
    .is("completed_at", null)
    .is("deleted_at", null)
    .order("due_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (error)
    throw new Error("No se pudieron cargar los pendientes del estudio.");
  return (
    <section className="panel padded" style={{ marginBottom: 24 }}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">PARA TENERLO PRESENTE</p>
          <h2>Pendientes del estudio</h2>
        </div>
        <span className="tag">{count || 0} pendientes</span>
      </div>
      {data?.length ? (
        data.map((note) => (
          <NoteRow
            key={note.id + ":" + note.version}
            note={note as ProjectNote}
            writable={canWriteProject(ctx.membership!.role)}
            showProject
          />
        ))
      ) : (
        <p className="muted">
          No hay pendientes en esta página. Puedes registrar correcciones,
          visitas y entregas desde cada proyecto.
        </p>
      )}
      <div className="form-actions">
        <Link className="text-link" href="/proyectos">
          Abrir proyectos →
        </Link>
        {page > 1 && (
          <Link
            className="button button-outline"
            href={`/?pendingPage=${page - 1}`}
          >
            Anteriores
          </Link>
        )}
        {page * 20 < (count || 0) && (
          <Link
            className="button button-outline"
            href={`/?pendingPage=${page + 1}`}
          >
            Más pendientes
          </Link>
        )}
      </div>
    </section>
  );
}
export async function ProjectWorkspace({
  project,
  notesPage = 1,
  visitsPage = 1,
}: {
  project: string;
  notesPage?: number;
  visitsPage?: number;
}) {
  const ctx = await requireContext();
  if (!(await projectWorkspaceReady()))
    return (
      <p className="notice">
        La bitácora y los pendientes de este expediente están en preparación.
        Puedes seguir usando las cotizaciones y los cobros actuales.
      </p>
    );
  const writable = canWriteProject(ctx.membership.role);
  const [notes, visits] = await Promise.all([
    ctx.db
      .from("project_notes")
      .select(
        "id,project_id,kind,body,due_on,completed_at,version,created_at",
        { count: "exact" },
      )
      .eq("organization_id", ctx.organization.id)
      .eq("project_id", project)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range((notesPage - 1) * 20, notesPage * 20 - 1),
    ctx.db
      .from("project_observations")
      .select("id,body,observed_on,created_at", { count: "exact" })
      .eq("organization_id", ctx.organization.id)
      .eq("project_id", project)
      .eq("published", true)
      .is("deleted_at", null)
      .order("observed_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range((visitsPage - 1) * 10, visitsPage * 10 - 1),
  ]);
  if (notes.error || visits.error)
    throw new Error("No se pudo cargar la bitácora del proyecto.");
  const photos = visits.data?.length
    ? await ctx.db
        .from("project_photos")
        .select("id,observation_id")
        .eq("organization_id", ctx.organization.id)
        .in(
          "observation_id",
          visits.data.map((v) => v.id),
        )
    : null;
  if (photos?.error) throw new Error("No se pudieron cargar las fotografías.");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.organization.timezone,
  }).format(new Date());
  const href = (n: number, v: number) =>
    `/proyectos/${project}?notes=${n}&visits=${v}`;
  return (
    <div className="project-stack">
      <section className="panel padded" id="pendientes">
        <h2>Notas y pendientes</h2>
        <p className="muted">
          Correcciones de planos, actualizaciones y recordatorios. Los
          pendientes abiertos también aparecen en Inicio.
        </p>
        {writable && <NoteForm project={project} />}
        <div>
          {notes.data?.map((note) => (
            <NoteRow
              key={note.id + ":" + note.version}
              note={note as ProjectNote}
              writable={writable}
            />
          ))}
          {!notes.data?.length && (
            <p className="muted">Todavía no hay notas en esta página.</p>
          )}
        </div>
        <div className="form-actions">
          <span className="caption">
            {notes.count || 0} notas y pendientes · Página {notesPage}
          </span>
          {notesPage > 1 && (
            <Link
              className="button button-outline"
              href={href(notesPage - 1, visitsPage)}
            >
              Anteriores
            </Link>
          )}
          {notesPage * 20 < (notes.count || 0) && (
            <Link
              className="button button-outline"
              href={href(notesPage + 1, visitsPage)}
            >
              Siguientes
            </Link>
          )}
        </div>
      </section>
      <section className="panel padded" id="bitacora">
        <h2>Bitácora de obra y fotografías</h2>
        <p className="muted">
          Un registro fechado de lo que observaste en cada visita.
        </p>
        {writable && (
          <ObservationForm
            project={project}
            today={today}
            requestId={crypto.randomUUID()}
          />
        )}
        <div>
          {visits.data?.map((visit) => (
            <article className="activity-row" key={visit.id}>
              <p className="eyebrow">VISITA · {visit.observed_on}</p>
              <p className="observation-body">{visit.body}</p>
              <div className="photo-grid">
                {photos?.data
                  ?.filter((p) => p.observation_id === visit.id)
                  .map((photo, index) => (
                    <a
                      key={photo.id}
                      href={`/api/fotografias/${photo.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/fotografias/${photo.id}`}
                        alt={`Fotografía ${index + 1} de la visita del ${visit.observed_on}`}
                        loading="lazy"
                      />
                      <small>Abrir fotografía {index + 1}</small>
                    </a>
                  ))}
              </div>
            </article>
          ))}
          {!visits.data?.length && (
            <p className="muted">
              Todavía no hay observaciones publicadas en esta página.
            </p>
          )}
        </div>
        <div className="form-actions">
          <span className="caption">
            {visits.count || 0} visitas · Página {visitsPage}
          </span>
          {visitsPage > 1 && (
            <Link
              className="button button-outline"
              href={href(notesPage, visitsPage - 1)}
            >
              Anteriores
            </Link>
          )}
          {visitsPage * 10 < (visits.count || 0) && (
            <Link
              className="button button-outline"
              href={href(notesPage, visitsPage + 1)}
            >
              Siguientes
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

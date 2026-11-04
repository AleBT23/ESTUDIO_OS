import Link from "next/link";
import { Layers3 } from "lucide-react";
import { getContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    crear?: string;
    page?: string;
    state?: string;
  }>;
}) {
  const ctx = await getContext();
  const filter = await searchParams;
  const q = typeof filter.q === "string" ? filter.q.slice(0, 120) : "";
  const section =
    filter.crear === "pendiente"
      ? "#pendientes"
      : filter.crear === "visita"
        ? "#bitacora"
        : "";
  const states: Record<string, string> = {
    active: "Activo",
    paused: "Pausado",
    closed: "Cerrado",
    archived: "Archivado",
  };
  const state =
    filter.state && Object.hasOwn(states, filter.state) ? filter.state : "";
  const page = Math.max(
    1,
    Math.min(1000000, parseInt(filter.page || "1") || 1),
  );
  const perPage = 30;
  let total = 0;
  const href = (n: number) =>
    "/proyectos?" +
    new URLSearchParams({
      q,
      state,
      ...(section ? { crear: filter.crear! } : {}),
      page: String(n),
    });
  let projects: {
    id: string;
    name: string;
    state: string;
    start_date: string;
  }[] = [];
  if (ctx?.organization) {
    let query = ctx.db
      .from("projects")
      .select("id,name,state,start_date", { count: "exact" })
      .eq("organization_id", ctx.organization.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * perPage, page * perPage - 1);
    if (state) query = query.eq("state", state);
    if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
    const result = await query;
    if (result.error) throw new Error("No se pudieron cargar los proyectos.");
    total = result.count ?? 0;
    projects = result.data || [];
  }
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">DE LA IDEA A LA ENTREGA</p>
        <h1>Proyectos y producción</h1>
        <p>
          {section
            ? "Selecciona el proyecto para registrar " +
              (filter.crear === "visita" ? "la visita." : "el pendiente.")
            : "Un expediente compartido para arquitectura y visualización."}
        </p>
      </div>
      {ctx?.organization && (
        <div className="toolbar">
          <form className="search-form" style={{ marginBottom: 24 }}>
            {section && (
              <input type="hidden" name="crear" value={filter.crear} />
            )}
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label="Buscar proyecto"
              placeholder="Buscar proyecto…"
            />
            <label>
              Estado
              <select name="state" defaultValue={state}>
                <option value="">Todos</option>
                {Object.entries(states).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-outline">Buscar</button>
          </form>
          {ctx.membership && canReadFinance(ctx.membership.role) && (
            <Link className="button button-primary" href="/proyectos/nuevo">
              Nuevo proyecto +
            </Link>
          )}
        </div>
      )}
      {projects.length ? (
        <div className="overview-grid">
          {projects.map((project) => (
            <Link
              key={project.id}
              className="panel overview-card"
              href={`/proyectos/${project.id}${section}`}
            >
              <Layers3 size={22} />
              <h3>{project.name}</h3>
              <p>
                {states[project.state] ?? project.state} · {project.start_date}
              </p>
              <span className="card-action">Abrir expediente →</span>
            </Link>
          ))}
        </div>
      ) : (
        <section className="panel empty-state">
          <Layers3 size={32} />
          <h2>
            {q || state || page > 1
              ? "Sin coincidencias en esta página"
              : "Del acuerdo al trabajo"}
          </h2>
          <p>
            {ctx?.organization
              ? "Al aceptar una propuesta emitida se crea aquí su expediente y los paquetes de cada línea de negocio."
              : "Conecta tu estudio para vincular propuestas aceptadas con sus proyectos."}
          </p>
          <Link
            className="button button-primary"
            href={
              ctx?.organization ? "/comercial/cotizaciones" : "/configuracion"
            }
          >
            {ctx?.organization ? "Ir a cotizaciones" : "Conectar mi estudio"}
          </Link>
        </section>
      )}
      {ctx?.organization && (
        <nav aria-label="Páginas de proyectos" className="form-actions">
          <span>
            {total} proyectos · Página {page}
          </span>
          {page > 1 && <Link href={href(page - 1)}>Anterior</Link>}
          {page * perPage < total && (
            <Link href={href(page + 1)}>Siguiente</Link>
          )}
        </nav>
      )}
      <p className="caption" style={{ marginTop: 24 }}>
        Cada expediente reúne notas, pendientes, visitas, fotografías e
        historial de cobros.
      </p>
    </>
  );
}

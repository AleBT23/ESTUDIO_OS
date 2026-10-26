import Link from "next/link";
import { Layers3 } from "lucide-react";
import { getContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await getContext();
  const filter = await searchParams;
  const q = typeof filter.q === "string" ? filter.q.slice(0, 120) : "";
  let projects: {
    id: string;
    name: string;
    state: string;
    start_date: string;
  }[] = [];
  if (ctx?.organization) {
    let query = ctx.db
      .from("projects")
      .select("id,name,state,start_date")
      .eq("organization_id", ctx.organization.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
    const result = await query;
    if (result.error) throw new Error("No se pudieron cargar los proyectos.");
    projects = result.data || [];
  }
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">DE LA IDEA A LA ENTREGA</p>
        <h1>Proyectos y producción</h1>
        <p>Un expediente compartido para arquitectura y visualización.</p>
      </div>
      {ctx?.organization && (
        <div className="toolbar">
          <form className="search-form" style={{ marginBottom: 24 }}>
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label="Buscar proyecto"
              placeholder="Buscar proyecto…"
            />
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
              href={`/proyectos/${project.id}`}
            >
              <Layers3 size={22} />
              <h3>{project.name}</h3>
              <p>
                {project.state === "active" ? "Activo" : project.state} ·{" "}
                {project.start_date}
              </p>
              <span className="card-action">Abrir expediente →</span>
            </Link>
          ))}
        </div>
      ) : (
        <section className="panel empty-state">
          <Layers3 size={32} />
          <h2>{q ? "Sin coincidencias" : "Del acuerdo al trabajo"}</h2>
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
      <p className="caption" style={{ marginTop: 24 }}>
        Vista limitada a 200 resultados por búsqueda. Cada expediente reúne
        notas, pendientes, visitas, fotografías e historial de cobros.
      </p>
    </>
  );
}

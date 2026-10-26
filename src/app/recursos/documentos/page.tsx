import Link from "next/link";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { Button } from "@/shared/ui/button";
import {
  StudioDocumentForm,
  IssueStudioDocumentForm,
} from "@/modules/documents/standalone-form";
import {
  documentKinds,
  type StudioDocument,
} from "@/modules/documents/standalone-schema";
export default async function StudioDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    new?: string;
    selected?: string;
    edit?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return (
      <p className="notice">
        La creación y consulta de documentos del estudio está disponible para
        administradores.
      </p>
    );
  const filter = await searchParams;
  const q = typeof filter.q === "string" ? filter.q.trim().slice(0, 120) : "";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(filter.page || "1") || 1),
  );
  let query = ctx.db
    .from("studio_documents")
    .select("id,title,kind,version,updated_at", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range((page - 1) * 30, page * 30 - 1);
  if (q) query = query.ilike("title", "%" + q.replace(/[\\%_]/g, "\\$&") + "%");
  const list = await query;
  if (list.error) throw new Error("No se pudieron cargar los documentos.");
  let selected: StudioDocument | undefined;
  if (z.uuid().safeParse(filter.selected).success) {
    const result = await ctx.db
      .from("studio_documents")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .eq("id", filter.selected)
      .is("deleted_at", null)
      .maybeSingle();
    if (result.error) throw new Error("No se pudo cargar el documento.");
    selected = (result.data as StudioDocument) || undefined;
  }
  const editing = filter.new === "1" || (selected && filter.edit === "1");
  const [clients, projects] = editing
    ? await Promise.all([
        ctx.db
          .from("clients")
          .select("id,name")
          .eq("organization_id", ctx.organization.id)
          .is("deleted_at", null)
          .order("name")
          .limit(500),
        ctx.db
          .from("projects")
          .select("id,name,client_id")
          .eq("organization_id", ctx.organization.id)
          .is("deleted_at", null)
          .order("name")
          .limit(500),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (clients.error || projects.error)
    throw new Error("No se pudieron consultar clientes y proyectos.");
  const versions =
    selected && !editing
      ? await ctx.db
          .from("generated_documents")
          .select("id,folio,draft_version,state,issued_at")
          .eq("organization_id", ctx.organization.id)
          .eq("document_id", selected.id)
          .eq("state", "issued")
          .order("issued_at", { ascending: false })
      : null;
  if (versions?.error)
    throw new Error("No se pudo consultar el historial documental.");
  const href = (n: number) =>
    "/recursos/documentos?" + new URLSearchParams({ q, page: String(n) });
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">CADA ACUERDO, POR ESCRITO</p>
        <h1>Documentos del estudio</h1>
        <p>Cartas, oficios, minutas y reportes con tu identidad.</p>
      </div>
      <nav className="tabs" aria-label="Recursos">
        <Link href="/recursos">Identidad gráfica</Link>
        <Link href="/recursos/documentos" className="selected">
          Documentos
        </Link>
        <span className="planned">Plantillas · pendiente</span>
        <span className="planned">Biblioteca · pendiente</span>
        <span className="planned">Procedimientos · pendiente</span>
      </nav>
      {editing ? (
        <StudioDocumentForm
          key={filter.new === "1" ? "new" : selected?.id}
          document={filter.new === "1" ? undefined : selected}
          clients={clients.data || []}
          projects={projects.data || []}
        />
      ) : selected ? (
        <>
          <section className="panel padded">
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  {documentKinds[selected.kind]} · EDICIÓN {selected.version}
                </p>
                <h2>{selected.title}</h2>
              </div>
              <Button asChild variant="outline">
                <Link
                  href={
                    "/recursos/documentos?selected=" + selected.id + "&edit=1"
                  }
                >
                  Editar una nueva revisión
                </Link>
              </Button>
            </div>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {selected.body}
            </p>
            <p className="caption">
              La vista previa usa el documento guardado y resuelve las variables
              con su contexto actual. Los PDFs emitidos conservan su versión
              original.
            </p>
            <div className="form-actions">
              <a
                className="button button-outline"
                target="_blank"
                rel="noreferrer"
                href={"/api/documentos-estudio/" + selected.id + "/preview"}
              >
                Vista previa PDF ↗
              </a>
              <IssueStudioDocumentForm
                id={selected.id}
                version={selected.version}
                alreadyIssued={
                  !!versions?.data?.some(
                    (v) => v.draft_version === selected.version,
                  )
                }
              />
            </div>
          </section>
          <section className="panel padded" style={{ marginTop: 24 }}>
            <h2>Versiones emitidas</h2>
            {versions?.data?.length ? (
              versions.data.map((v) => (
                <div className="version-row" key={v.id}>
                  <span>
                    {v.folio}
                    <small>Edición {v.draft_version}</small>
                  </span>
                  <a
                    className="button button-outline"
                    href={"/api/documentos/" + v.id}
                  >
                    Descargar PDF
                  </a>
                </div>
              ))
            ) : (
              <p className="muted">Aún no se ha emitido este documento.</p>
            )}
          </section>
          <Button asChild variant="ghost">
            <Link href="/recursos/documentos">← Todos los documentos</Link>
          </Button>
        </>
      ) : (
        <>
          <div className="toolbar">
            <form className="search-form">
              <input
                type="search"
                name="q"
                aria-label="Buscar documento"
                placeholder="Buscar documento…"
                defaultValue={q}
              />
              <Button variant="outline">Buscar</Button>
            </form>
            <Button asChild>
              <Link href="/recursos/documentos?new=1">Nuevo documento +</Link>
            </Button>
          </div>
          {list.data?.length ? (
            <div className="overview-grid">
              {list.data.map((doc) => (
                <Link
                  className="panel overview-card"
                  key={doc.id}
                  href={"/recursos/documentos?selected=" + doc.id}
                >
                  <p className="eyebrow">
                    {documentKinds[doc.kind as keyof typeof documentKinds]}
                  </p>
                  <h3>{doc.title}</h3>
                  <span className="card-action">Abrir documento →</span>
                </Link>
              ))}
            </div>
          ) : (
            <section className="panel empty-state">
              <h2>
                {q ? "Sin coincidencias" : "El siguiente acuerdo empieza aquí"}
              </h2>
              <p>
                Prepara un documento independiente, con membrete y sin
                presupuesto obligatorio.
              </p>
            </section>
          )}
          <div className="form-actions">
            {page > 1 && (
              <Button asChild variant="outline">
                <Link href={href(page - 1)}>Anterior</Link>
              </Button>
            )}
            <span className="caption">
              Página {page} · {list.count || 0} documentos
            </span>
            {page * 30 < (list.count || 0) && (
              <Button asChild variant="outline">
                <Link href={href(page + 1)}>Siguiente</Link>
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
}

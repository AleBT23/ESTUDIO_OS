import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { saveLibraryRevision } from "@/modules/resources/library-action";
const path = "/recursos/biblioteca";
export default async function Library({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; resource?: string; page?: string }>;
}) {
  const ctx = await requireContext(),
    org = ctx.organization.id,
    filters = await searchParams;
  const q = (filters.q || "").trim().slice(0, 120),
    page = Math.min(10000, Math.max(1, parseInt(filters.page || "1") || 1));
  let query = ctx.db
    .from("current_library_resources")
    .select("resource_id,title,tags,version", { count: "exact" })
    .eq("organization_id", org);
  if (q)
    query = query.ilike(
      "search_text",
      "%" + q.replace(/[\\%_]/g, "\\$&") + "%",
    );
  const [list, history] = await Promise.all([
    query
      .order("title")
      .order("resource_id")
      .range((page - 1) * 30, page * 30 - 1),
    filters.resource
      ? ctx.db
          .from("library_revisions")
          .select("id,resource_id,title,version,tags,url,notes,filename")
          .eq("organization_id", org)
          .eq("resource_id", filters.resource)
          .order("version", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (list.error || history.error)
    throw Error("No se pudo cargar la biblioteca.");
  const latest = history.data[0],
    href = (p: number, r = "") =>
      path + "?" + new URLSearchParams({ q, page: String(p), resource: r });
  return (
    <>
      <Link href="/recursos">Recursos</Link>
      <h1>Biblioteca técnica y BIM</h1>
      <form className="toolbar">
        <label>
          Buscar por título, etiqueta o descripción
          <input name="q" type="search" defaultValue={q} />
        </label>
        <button className="button">Buscar</button>
      </form>
      <section className="panel padded">
        <h2>Recursos</h2>
        {!list.data.length && <p>Sin recursos para esta búsqueda.</p>}
        {list.data.map((r) => (
          <p key={r.resource_id}>
            <Link href={href(page, r.resource_id)}>{r.title}</Link> · v
            {r.version} · {r.tags}
          </p>
        ))}
        {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
        {page * 30 < (list.count || 0) && (
          <Link href={href(page + 1)}>Siguiente</Link>
        )}
      </section>
      {latest && (
        <section className="panel padded">
          <h2>Versiones de {latest.title}</h2>
          {history.data.map((r) => (
            <article key={r.id}>
              <h3>
                v{r.version} · {r.title}
              </h3>
              <p>{r.tags}</p>
              <p>{r.notes}</p>
              {r.url && (
                <p>
                  <a href={r.url}>Abrir vínculo</a>
                </p>
              )}
              {r.filename && (
                <a href={"/api/biblioteca/" + r.id}>Descargar {r.filename}</a>
              )}
            </article>
          ))}
        </section>
      )}
      {canManageCommercial(ctx.membership.role) && (
        <>
          <h2>{latest ? "Publicar nueva versión" : "Añadir recurso"}</h2>
          {latest && <Link href={href(page)}>Crear otro recurso</Link>}
          <RecordForm
            key={latest?.id || "new"}
            id={crypto.randomUUID()}
            save={saveLibraryRevision}
          >
            <input
              type="hidden"
              name="resource_id"
              value={latest?.resource_id || ""}
            />
            <input
              type="hidden"
              name="version"
              value={(latest?.version || 0) + 1}
            />
            <label>
              Título
              <input
                name="title"
                required
                maxLength={160}
                defaultValue={latest?.title}
              />
            </label>
            <label>
              Etiquetas
              <input name="tags" maxLength={300} defaultValue={latest?.tags} />
            </label>
            <label>
              Descripción
              <textarea
                name="notes"
                maxLength={8000}
                defaultValue={latest?.notes}
              />
            </label>
            <label>
              Vínculo al recurso o modelo
              <input name="url" type="url" defaultValue={latest?.url} />
            </label>
            <label>
              Adjunto de esta versión (hasta 2 MiB)
              <input type="file" name="file" />
            </label>
            {latest?.filename && (
              <p>
                El archivo anterior permanece disponible en su versión. Para
                incluir un archivo en la nueva versión, selecciónalo aquí.
              </p>
            )}
          </RecordForm>
        </>
      )}
    </>
  );
}

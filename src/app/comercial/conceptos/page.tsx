import Link from "next/link";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { CommercialTabs } from "@/shared/ui/commercial-tabs";
import { Button } from "@/shared/ui/button";
import { ConceptForm, ArchiveConceptForm } from "@/modules/quotes/concept-form";
import type { Concept } from "@/modules/quotes/concept-schema";
export default async function ConceptsPage({
  searchParams,
}: {
  searchParams: Promise<{
    selected?: string;
    new?: string;
    edit?: string;
    archived?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return (
      <p className="notice">
        Los conceptos comerciales están disponibles para administradores.
      </p>
    );
  const filter = await searchParams;
  const q = typeof filter.q === "string" ? filter.q.trim().slice(0, 120) : "";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(filter.page || "1") || 1),
  );
  let query = ctx.db
    .from("concepts")
    .select("id,name,body,version,deleted_at", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .order("name")
    .range((page - 1) * 30, page * 30 - 1);
  query =
    filter.archived === "1"
      ? query.not("deleted_at", "is", null)
      : query.is("deleted_at", null);
  if (q) query = query.ilike("name", "%" + q.replace(/[\\%_]/g, "\\$&") + "%");
  const result = await query;
  if (result.error)
    throw new Error("No se pudo cargar la biblioteca de conceptos.");
  let selected: Concept | undefined;
  if (z.uuid().safeParse(filter.selected).success) {
    const fetched = await ctx.db
      .from("concepts")
      .select("id,name,body,version,deleted_at")
      .eq("organization_id", ctx.organization.id)
      .eq("id", filter.selected)
      .maybeSingle();
    if (fetched.error) throw new Error("No se pudo consultar el concepto.");
    selected = (fetched.data as Concept) || undefined;
  }
  const href = (n: number) =>
    "/comercial/conceptos?" +
    new URLSearchParams({
      q,
      archived: filter.archived === "1" ? "1" : "0",
      page: String(n),
    });
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">EL CRITERIO QUE SE CONSERVA</p>
        <h1>Conceptos reutilizables</h1>
        <p>Textos cuidados para dar claridad a cada alcance.</p>
      </div>
      <CommercialTabs active="/comercial/conceptos" />
      {filter.new === "1" ||
      (selected && !selected.deleted_at && filter.edit === "1") ? (
        <ConceptForm
          key={filter.new === "1" ? "new" : selected?.id}
          concept={filter.new === "1" ? undefined : selected}
        />
      ) : selected ? (
        <section className="panel padded">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {selected.deleted_at ? "ARCHIVADO" : "BIBLIOTECA COMERCIAL"} ·
                VERSIÓN {selected.version}
              </p>
              <h2>{selected.name}</h2>
            </div>
            {!selected.deleted_at && (
              <Button asChild variant="outline">
                <Link
                  href={
                    "/comercial/conceptos?selected=" + selected.id + "&edit=1"
                  }
                >
                  Editar
                </Link>
              </Button>
            )}
          </div>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {selected.body}
          </p>
          <p className="caption">
            Puedes insertarlo desde la descripción de cada partida en el editor
            de cotizaciones.
          </p>
          <div className="form-actions">
            <Button asChild variant="ghost">
              <Link href="/comercial/conceptos">Volver a conceptos</Link>
            </Button>
            <ArchiveConceptForm concept={selected} />
          </div>
        </section>
      ) : (
        <>
          <div className="toolbar">
            <form className="search-form">
              <input
                type="search"
                name="q"
                defaultValue={q}
                aria-label="Buscar concepto"
                placeholder="Buscar concepto…"
              />
              <select
                name="archived"
                defaultValue={filter.archived === "1" ? "1" : "0"}
                aria-label="Estado de conceptos"
              >
                <option value="0">Activos</option>
                <option value="1">Archivados</option>
              </select>
              <Button variant="outline">Buscar</Button>
            </form>
            <Button asChild>
              <Link href="/comercial/conceptos?new=1">Nuevo concepto +</Link>
            </Button>
          </div>
          {result.data?.length ? (
            <div className="overview-grid">
              {result.data.map((concept) => (
                <Link
                  className="panel overview-card"
                  key={concept.id}
                  href={"/comercial/conceptos?selected=" + concept.id}
                >
                  <h3>{concept.name}</h3>
                  <p>
                    {concept.body.slice(0, 180)}
                    {concept.body.length > 180 ? "…" : ""}
                  </p>
                  <span className="card-action">Abrir concepto →</span>
                </Link>
              ))}
            </div>
          ) : (
            <section className="panel empty-state">
              <h2>
                {q ? "Sin coincidencias" : "Un texto útil, muchas propuestas"}
              </h2>
              <p>
                {filter.archived === "1"
                  ? "Los conceptos archivados permanecen disponibles para restauración."
                  : "Guarda descripciones de alcance y notas habituales para insertarlas en tus cotizaciones."}
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
              Página {page} · {result.count || 0} conceptos
            </span>
            {page * 30 < (result.count || 0) && (
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

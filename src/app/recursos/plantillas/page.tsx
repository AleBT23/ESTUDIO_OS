import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { documentKinds } from "@/modules/documents/standalone-schema";
export default async function Templates({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; historial?: string }>;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return <p className="notice">Permisos insuficientes.</p>;
  const f = await searchParams,
    page = Math.max(1, Math.min(10000, parseInt(f.page ?? "1") || 1)),
    org = ctx.organization.id,
    history = f.historial === "1";
  const { data, error, count } = await ctx.db
    .from(history ? "document_templates" : "latest_document_templates")
    .select("id,name,version,kind", { count: "exact" })
    .eq("organization_id", org)
    .order("name")
    .order("version", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  const href = (n: number) =>
    "?historial=" + (history ? "1" : "0") + "&page=" + n;
  return (
    <>
      <header className="page-heading">
        <Link href="/recursos/documentos">Documentos del estudio</Link>
        <h1>Plantillas documentales</h1>
        <p>
          Guarda una versión desde un documento del estudio y úsala como base
          para otro cliente o proyecto.
        </p>
      </header>
      <nav className="tabs">
        <Link href="?historial=0">Últimas versiones</Link>
        <Link href="?historial=1">Historial completo</Link>
      </nav>
      {error ? (
        <p className="notice">No se pudieron consultar las plantillas.</p>
      ) : (
        <section className="panel padded">
          {data.length ? (
            data.map((t) => (
              <article key={t.id} className="activity-row">
                <strong>
                  {t.name} · v{t.version}
                </strong>
                <p>
                  {documentKinds[t.kind as keyof typeof documentKinds]} ·{" "}
                  <Link href={"/recursos/documentos?new=1&plantilla=" + t.id}>
                    Crear documento con esta versión
                  </Link>
                </p>
              </article>
            ))
          ) : (
            <p>No hay plantillas en esta página.</p>
          )}
          {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
          {page * 25 < (count ?? 0) && (
            <Link href={href(page + 1)}>Siguiente</Link>
          )}
        </section>
      )}
    </>
  );
}

export const metadata = { title: "Plantillas" };

import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { changeFavorite } from "./favorite-action";
import {
  canManageCommercial,
  canReadFinance,
  canWriteProject,
} from "@/shared/permissions";
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; favorites?: string; page?: string }>;
}) {
  const ctx = await requireContext(),
    q = await searchParams,
    term = typeof q.q === "string" ? q.q.trim().slice(0, 120) : "",
    favorites = q.favorites === "1",
    page = Math.min(10000, Math.max(1, parseInt(q.page || "1") || 1));
  const sources = [
    ["projects", "Proyectos", "/proyectos/"],
    ["clients", "Clientes", "/comercial/clientes/"],
    ["library", "Biblioteca técnica", "/recursos/biblioteca?resource="],
    ...(canWriteProject(ctx.membership.role)
      ? [
          [
            "personal_reminders",
            "Mis recordatorios",
            "/agenda/recordatorios?id=",
          ],
        ]
      : []),
    ...(canManageCommercial(ctx.membership.role)
      ? [
          ["quotes", "Cotizaciones", "/comercial/cotizaciones/"],
          [
            "studio_documents",
            "Documentos del estudio",
            "/recursos/documentos?selected=",
          ],
          ["opportunities", "Oportunidades", "/comercial/pipeline?selected="],
          [
            "editorial_items",
            "Calendario editorial",
            "/comercial/marketing?edit=",
          ],
        ]
      : []),
    ...(canReadFinance(ctx.membership.role)
      ? [
          [
            "suppliers",
            "Proveedores y subcontratistas",
            "/administracion/proveedores/",
          ],
          ["works", "Obras", "/obras?obra="],
          [
            "finance_cases",
            "Acuerdos financieros",
            "/administracion/operaciones/",
          ],
        ]
      : []),
  ];
  const groups =
    !favorites && term.length < 2
      ? []
      : await Promise.all(
          sources.map(async ([source, label, path]) => {
            let query = ctx.db
              .from("personal_search_results")
              .select("id,label,favorite", { count: "exact" })
              .eq("organization_id", ctx.organization.id)
              .eq("source", source);
            if (term)
              query = query.ilike(
                "label",
                "%" + term.replace(/[\\%_]/g, "\\$&") + "%",
              );
            if (favorites) query = query.eq("favorite", true);
            const r = await query
              .order("label")
              .order("id")
              .range((page - 1) * 10, page * 10 - 1);
            return { source, label, path, ...r };
          }),
        );
  const href = (n: number) =>
    "/buscar?" +
    new URLSearchParams({
      q: term,
      favorites: favorites ? "1" : "0",
      page: String(n),
    });
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">ESTUDIO</p>
        <h1>{favorites ? "Mis favoritos" : "Búsqueda global"}</h1>
      </header>
      <nav className="tabs">
        <Link href="/buscar">Buscar registros</Link>
        <Link href="/buscar?favorites=1">Mis favoritos</Link>
      </nav>
      <form className="search-form">
        {favorites && <input type="hidden" name="favorites" value="1" />}
        <label>
          {favorites ? "Filtrar favoritos" : "Buscar en el estudio"}
          <input
            type="search"
            name="q"
            minLength={favorites ? 1 : 2}
            maxLength={120}
            defaultValue={term}
            required={!favorites}
          />
        </label>
        <button className="button button-primary">Buscar</button>
      </form>
      {!groups.length && <p>Escribe al menos dos caracteres.</p>}
      {groups
        .filter((g) => g.error || g.data?.length)
        .map((g) => (
          <section key={g.source} className="panel padded">
            <h2>{g.label}</h2>
            {g.error ? (
              <p>Consulta no disponible.</p>
            ) : (
              <ul>
                {g.data?.map((r) => (
                  <li key={r.id}>
                    <Link href={g.path + r.id}>{r.label}</Link>
                    <form action={changeFavorite}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="source" value={g.source} />
                      <button
                        className="button button-outline"
                        name="intent"
                        value={r.favorite ? "remove" : "add"}
                      >
                        {r.favorite
                          ? "Quitar de favoritos"
                          : "Guardar en favoritos"}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      {groups.length > 0 &&
        groups.every((g) => !g.error && !g.data?.length) && (
          <p>
            {favorites
              ? "Sin favoritos en esta selección."
              : "No se encontraron coincidencias."}
          </p>
        )}
      {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
      {groups.some((g) => (g.count || 0) > page * 10) && (
        <Link href={href(page + 1)}>Siguiente</Link>
      )}
    </>
  );
}

export const metadata = { title: "Buscar en el estudio" };

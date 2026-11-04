import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial, canReadFinance } from "@/shared/permissions";
export default async function Search({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireContext();
  const input = (await searchParams).q,
    term = typeof input === "string" ? input.trim().slice(0, 120) : "";
  const sources = [
    {
      label: "Proyectos",
      table: "projects",
      field: "name",
      active: true,
      path: "/proyectos/",
    },
    {
      label: "Clientes",
      table: "clients",
      field: "name",
      active: true,
      path: "/comercial/clientes/",
    },
    ...(canManageCommercial(ctx.membership.role)
      ? [
          {
            label: "Cotizaciones",
            table: "quotes",
            field: "name",
            active: true,
            path: "/comercial/cotizaciones/",
          },
          {
            label: "Documentos del estudio",
            table: "studio_documents",
            field: "title",
            active: true,
            path: "/recursos/documentos?selected=",
          },
        ]
      : []),
    ...(canReadFinance(ctx.membership.role)
      ? [
          {
            label: "Obras",
            table: "works",
            field: "name",
            active: false,
            path: "/obras?obra=",
          },
          {
            label: "Acuerdos financieros",
            table: "finance_cases",
            field: "name",
            active: false,
            path: "/administracion/operaciones/",
          },
        ]
      : []),
  ];
  const groups =
    term.length < 2
      ? []
      : await Promise.all(
          sources.map(async (source) => {
            let query = ctx.db
              .from(source.table)
              .select("id,label:" + source.field)
              .eq("organization_id", ctx.organization.id)
              .ilike(source.field, "%" + term.replace(/[\\%_]/g, "\\$&") + "%")
              .order(source.field)
              .order("id")
              .limit(10);
            if (source.active) query = query.is("deleted_at", null);
            const { data, error } = await query;
            return {
              ...source,
              error,
              rows: (data ?? []) as unknown as { id: string; label: string }[],
            };
          }),
        );
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">ESTUDIO</p>
        <h1>Búsqueda global</h1>
      </header>
      <form className="search-form">
        <label>
          Buscar en el estudio
          <input
            type="search"
            name="q"
            minLength={2}
            maxLength={120}
            defaultValue={term}
            required
          />
        </label>
        <button className="button button-primary">Buscar</button>
      </form>
      {!groups.length ? (
        <p>Escribe al menos dos caracteres.</p>
      ) : (
        <>
          <p>Hasta diez coincidencias por área.</p>
          {groups
            .filter((g) => g.error || g.rows.length)
            .map((g) => (
              <section key={g.table} className="panel padded">
                <h2>{g.label}</h2>
                {g.error ? (
                  <p>Consulta no disponible.</p>
                ) : (
                  <ul>
                    {g.rows.map((r) => (
                      <li key={r.id}>
                        <Link href={g.path + r.id}>{r.label}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          {groups.every((g) => !g.error && !g.rows.length) && (
            <p>No se encontraron coincidencias.</p>
          )}
        </>
      )}
    </>
  );
}

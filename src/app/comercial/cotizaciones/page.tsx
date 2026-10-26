import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { CommercialTabs } from "@/shared/ui/commercial-tabs";
import { Button } from "@/shared/ui/button";
import { formatMoney } from "@/shared/money";
import { QuoteActions } from "@/modules/quotes/quote-actions";
export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; deleted?: string }>;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return (
      <p className="notice">
        Las propuestas comerciales están disponibles para administradores.
      </p>
    );
  const filter = await searchParams;
  const q = typeof filter.q === "string" ? filter.q.slice(0, 120) : "";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(filter.page || "1") || 1),
  );
  let query = ctx.db
    .from("quotes")
    .select(
      "id,name,status,version,total_cents,currency,updated_at,clients(name)",
      {
        count: "exact",
      },
    )
    .eq("organization_id", ctx.organization.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range((page - 1) * 30, page * 30 - 1);
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error, count } = await query;
  if (error) throw new Error("No se pudieron cargar las cotizaciones.");
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">CADA ALCANCE, BIEN DEFINIDO</p>
        <h1>Cotizaciones</h1>
        <p>Propuestas de arquitectura y visualización en un mismo lugar.</p>
      </div>
      <CommercialTabs active="/comercial/cotizaciones" />
      {filter.deleted === "1" && (
        <p className="notice" role="status">
          Cotización eliminada de los listados activos. El historial y los
          documentos se conservan.
        </p>
      )}
      <div className="toolbar">
        <form className="search-form">
          <input
            type="search"
            name="q"
            aria-label="Buscar cotización"
            placeholder="Buscar por proyecto…"
            defaultValue={q}
          />
          <Button variant="outline">Buscar</Button>
        </form>
        <Button asChild>
          <Link href="/comercial/cotizaciones/nueva">Nueva cotización +</Link>
        </Button>
      </div>
      {data?.length ? (
        <div className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Estado</th>
                <th>Total MXN</th>
                <th>Actualización</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <Link
                      className="client-name"
                      href={`/comercial/cotizaciones/${quote.id}`}
                    >
                      {quote.name}
                    </Link>
                  </td>
                  <td>
                    <span className="tag">
                      {(
                        {
                          draft: "Borrador",
                          sent: "Enviada",
                          accepted: "Aceptada",
                          rejected: "Rechazada",
                          expired: "Vencida",
                        } as Record<string, string>
                      )[quote.status] || "Estado por revisar"}
                    </span>
                  </td>
                  <td>{formatMoney(quote.total_cents, quote.currency)}</td>
                  <td>
                    {new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                      timeZone: ctx.organization.timezone,
                    }).format(new Date(quote.updated_at))}
                  </td>
                  <td>
                    <QuoteActions
                      id={quote.id}
                      name={quote.name}
                      version={quote.version}
                      accepted={quote.status === "accepted"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="panel empty-state">
          <h2>Una propuesta para lo que viene</h2>
          <p>
            Comienza con un cliente y los servicios que necesita. Tus precios de
            catálogo se conservan al personalizar cada partida.
          </p>
        </section>
      )}
      <div className="form-actions">
        {page > 1 && (
          <Button asChild variant="outline">
            <Link
              href={`/comercial/cotizaciones?${new URLSearchParams({ q, page: String(page - 1) })}`}
            >
              Anterior
            </Link>
          </Button>
        )}
        <span className="caption">
          Página {page} · {count || 0} propuestas
        </span>
        {page * 30 < (count || 0) && (
          <Button asChild variant="outline">
            <Link
              href={`/comercial/cotizaciones?${new URLSearchParams({ q, page: String(page + 1) })}`}
            >
              Siguiente
            </Link>
          </Button>
        )}
      </div>
    </>
  );
}

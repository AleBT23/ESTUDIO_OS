import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { Button } from "@/shared/ui/button";
import { CommercialTabs } from "@/shared/ui/commercial-tabs";
import { ServiceForm, ArchiveServiceForm } from "@/modules/quotes/service-form";
import { units, type Service } from "@/modules/quotes/schema";
import { formatMoney } from "@/shared/money";
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    service?: string;
    new?: string;
    edit?: string;
    archived?: string;
    q?: string;
  }>;
}) {
  const ctx = await requireContext();
  const filter = await searchParams;
  if (!canManageCommercial(ctx.membership.role))
    return (
      <p className="notice">
        Los precios y costos comerciales están disponibles para administradores.
      </p>
    );
  const q = typeof filter.q === "string" ? filter.q.slice(0, 120) : "";
  let query = ctx.db
    .from("services")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("name")
    .limit(500);
  query =
    filter.archived === "1"
      ? query.not("deleted_at", "is", null)
      : query.is("deleted_at", null);
  if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await query;
  if (error) throw new Error("No se pudo cargar el catálogo.");
  const services = (data || []) as Service[];
  let selected = services.find((s) => s.id === filter.service);
  if (filter.service && !selected) {
    const result = await ctx.db
      .from("services")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .eq("id", filter.service)
      .maybeSingle();
    if (result.error) throw new Error("No se pudo cargar el servicio.");
    selected = (result.data as Service) || undefined;
  }
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">LA BASE DE TUS PROPUESTAS</p>
        <h1>Catálogo de servicios</h1>
        <p>Precios claros. Alcances que puedes adaptar a cada proyecto.</p>
      </div>
      <CommercialTabs active="/comercial/catalogo" />
      {filter.new === "1" ||
      (selected && filter.edit === "1" && !selected.deleted_at) ? (
        <ServiceForm
          service={filter.new === "1" ? undefined : selected}
          lines={ctx.lines}
        />
      ) : selected ? (
        <section className="panel padded">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {selected.code} · {selected.category || "Sin categoría"}
              </span>
              <h2>{selected.name}</h2>
            </div>
            {!selected.deleted_at && (
              <Button asChild variant="outline">
                <Link
                  href={`/comercial/catalogo?service=${selected.id}&edit=1`}
                >
                  Editar
                </Link>
              </Button>
            )}
          </div>
          <p>{selected.description || "Sin descripción"}</p>
          <p>
            {selected.unit === "pct"
              ? `${selected.price_cents / 100}% del costo de obra`
              : formatMoney(selected.price_cents)}{" "}
            · {units[selected.unit]}
          </p>
          <p className="muted">
            Costo estimado: {formatMoney(selected.estimated_cost_cents)} ·{" "}
            {ctx.lines.find((l) => l.id === selected.business_line_id)?.name}
          </p>
          <p className="caption">
            Vigencia: {selected.valid_until || "Sin vencimiento"} · Versión{" "}
            {selected.version}
          </p>
          <div className="form-actions">
            <Button asChild variant="ghost">
              <Link href="/comercial/catalogo">Volver al catálogo</Link>
            </Button>
            <ArchiveServiceForm service={selected} />
          </div>
        </section>
      ) : (
        <>
          <div className="toolbar">
            <form className="search-form">
              <input
                type="search"
                name="q"
                aria-label="Buscar servicio"
                placeholder="Buscar servicio…"
                defaultValue={q}
              />
              <select
                name="archived"
                defaultValue={filter.archived || "0"}
                aria-label="Estado de servicios"
              >
                <option value="0">Activos</option>
                <option value="1">Archivados</option>
              </select>
              <Button variant="outline">Buscar</Button>
            </form>
            <Button asChild>
              <Link href="/comercial/catalogo?new=1">
                <Plus size={15} />
                Nuevo servicio
              </Link>
            </Button>
          </div>
          {services.length ? (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Línea</th>
                    <th>Unidad</th>
                    <th>Precio</th>
                    <th>Vigencia</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td>
                        <Link
                          className="client-name"
                          href={`/comercial/catalogo?service=${service.id}`}
                        >
                          {service.name}
                          <small>
                            {service.code} ·{" "}
                            {service.category || "Sin categoría"}
                          </small>
                        </Link>
                      </td>
                      <td>
                        {
                          ctx.lines.find(
                            (l) => l.id === service.business_line_id,
                          )?.name
                        }
                      </td>
                      <td>{units[service.unit]}</td>
                      <td>
                        {service.unit === "pct"
                          ? `${service.price_cents / 100}%`
                          : formatMoney(service.price_cents)}
                      </td>
                      <td>{service.valid_until || "Sin vencimiento"}</td>
                      <td>
                        <Link
                          className="icon-button"
                          aria-label={`Abrir ${service.name}`}
                          href={`/comercial/catalogo?service=${service.id}`}
                        >
                          <ArrowUpRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <section className="panel empty-state">
              <h2>Tu catálogo, con tus reglas</h2>
              <p>
                {q
                  ? "No encontramos coincidencias."
                  : "Agrega servicios de arquitectura y visualización. Los precios y alcances se copiarán a cada propuesta para poder personalizarlos."}
              </p>
            </section>
          )}
          <p className="caption" style={{ marginTop: 16 }}>
            Hasta 500 resultados por búsqueda. Los servicios archivados
            conservan sus referencias.
          </p>
        </>
      )}
    </>
  );
}

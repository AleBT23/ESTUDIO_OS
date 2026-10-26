import Link from "next/link";
import { Plus, Users, Search, ArrowUpRight } from "lucide-react";
import { getContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { Button } from "@/shared/ui/button";
import { CommercialTabs } from "@/shared/ui/commercial-tabs";
export default async function CommercialPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    line?: string;
    archived?: string;
    page?: string;
  }>;
}) {
  const ctx = await getContext();
  const filters = await searchParams;
  const q = (typeof filters.q === "string" ? filters.q : "")
    .slice(0, 120)
    .trim();
  const line = ctx?.lines.find((l) => l.id === filters.line)?.id;
  const archived = filters.archived === "1";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(filters.page || "1") || 1),
  );
  let clients: {
    id: string;
    name: string;
    kind: string;
    email: string;
    phone: string;
    source: string;
    business_line_id: string | null;
    deleted_at: string | null;
  }[] = [];
  let count = 0;
  if (ctx?.organization) {
    let query = ctx.db
      .from("clients")
      .select("id,name,kind,email,phone,source,business_line_id,deleted_at", {
        count: "exact",
      })
      .eq("organization_id", ctx.organization.id)
      .order("name")
      .range((page - 1) * 30, page * 30 - 1);
    query = archived
      ? query.not("deleted_at", "is", null)
      : query.is("deleted_at", null);
    if (q) query = query.ilike("name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
    if (line) query = query.eq("business_line_id", line);
    const result = await query;
    if (result.error) throw new Error("No se pudo cargar el directorio.");
    clients = result.data || [];
    count = result.count || 0;
  }
  const canWrite = ctx?.membership && canManageCommercial(ctx.membership.role);
  const pageHref = (n: number) =>
    `/comercial?${new URLSearchParams({ q, line: line || "", archived: archived ? "1" : "0", page: String(n) })}`;
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">RELACIONES QUE CONSTRUYEN</p>
        <h1>Comercial</h1>
        <p>El comienzo de cada proyecto es una buena conversación.</p>
      </div>
      <CommercialTabs active="/comercial" />
      {!ctx?.organization ? (
        <section className="panel empty-state">
          <Users size={32} />
          <h2>Un lugar para cada relación</h2>
          <p>
            Conecta tu estudio para registrar clientes y conservar su
            información de forma privada.
          </p>
          <Button asChild>
            <Link href={ctx ? "/configuracion" : "/acceso"}>
              {ctx ? "Crear espacio" : "Acceder al estudio"}
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        </section>
      ) : (
        <>
          <div className="toolbar">
            <form className="search-form">
              <input
                type="search"
                name="q"
                aria-label="Buscar cliente por nombre"
                placeholder="Buscar cliente por nombre…"
                defaultValue={q}
              />
              <select
                name="line"
                aria-label="Línea de negocio"
                defaultValue={line || ""}
              >
                <option value="">Todas las líneas</option>
                {ctx.lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <select
                name="archived"
                aria-label="Estado de clientes"
                defaultValue={archived ? "1" : "0"}
              >
                <option value="0">Clientes activos</option>
                <option value="1">Archivados</option>
              </select>
              <Button variant="outline" aria-label="Aplicar filtros">
                <Search size={15} />
              </Button>
            </form>
            {canWrite && (
              <Button asChild>
                <Link href="/comercial/clientes/nuevo">
                  <Plus size={16} />
                  Nuevo cliente
                </Link>
              </Button>
            )}
          </div>
          <p className="caption">
            {count} {count === 1 ? "cliente" : "clientes"} ·{" "}
            {archived ? "Archivo recuperable" : "Directorio del estudio"}
          </p>
          {clients.length ? (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contacto</th>
                    <th>Línea de interés</th>
                    <th>Origen</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link
                          className="client-name"
                          href={`/comercial/clientes/${c.id}`}
                        >
                          {c.name}
                          <small>
                            {c.kind === "company" ? "Empresa" : "Persona"}
                          </small>
                        </Link>
                      </td>
                      <td>
                        {c.email || "Sin correo"}
                        <br />
                        <span className="caption">
                          {c.phone || "Sin teléfono"}
                        </span>
                      </td>
                      <td>
                        <span className="tag">
                          {ctx.lines.find((l) => l.id === c.business_line_id)
                            ?.name || "Ambas / por definir"}
                        </span>
                      </td>
                      <td>{c.source || "—"}</td>
                      <td>
                        <Link
                          className="icon-button"
                          href={`/comercial/clientes/${c.id}`}
                          aria-label={`Abrir ficha de ${c.name}`}
                        >
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <section className="panel empty-state">
              <Users size={28} />
              <h2>
                {q || line
                  ? "Sin coincidencias"
                  : archived
                    ? "Tu archivo está vacío"
                    : "Tu próxima relación empieza aquí"}
              </h2>
              <p>
                {q || line
                  ? "Prueba con otro nombre o cambia los filtros."
                  : archived
                    ? "Los clientes archivados se conservan aquí para poder restaurarlos."
                    : "Crea el primer cliente del estudio. Puedes añadir los detalles cuando los necesites."}
              </p>
              {canWrite && !archived && !q && !line && (
                <Button asChild>
                  <Link href="/comercial/clientes/nuevo">
                    Crear mi primer cliente
                    <Plus size={15} />
                  </Link>
                </Button>
              )}
            </section>
          )}
          <div className="form-actions">
            {page > 1 && (
              <Button asChild variant="outline">
                <Link href={pageHref(page - 1)}>Anterior</Link>
              </Button>
            )}
            <span className="caption">Página {page}</span>
            {page * 30 < count && (
              <Button asChild variant="outline">
                <Link href={pageHref(page + 1)}>Siguiente</Link>
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
}

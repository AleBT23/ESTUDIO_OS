import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { CommercialTabs } from "@/shared/ui/commercial-tabs";
import { RecordForm } from "@/shared/ui/record-form";
import { saveEditorial } from "@/modules/marketing/action";
const path = "/comercial/marketing";
const statuses = {
  idea: "Idea",
  scheduled: "Programado",
  published: "Publicado",
};
export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    portfolio?: string;
    edit?: string;
    page?: string;
  }>;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return <p>Acceso reservado a administración comercial.</p>;
  const filters = await searchParams;
  const month = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(filters.month || "")
    ? filters.month
    : "";
  const portfolio = filters.portfolio === "1";
  const page = Math.max(1, Math.min(10000, parseInt(filters.page || "1") || 1));
  const org = ctx.organization.id;
  let query = ctx.db
    .from("editorial_items")
    .select("*", { count: "exact" })
    .eq("organization_id", org);
  if (month) {
    const end = new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
    ).getUTCDate();
    query = query
      .gte("publication_on", month + "-01")
      .lte("publication_on", month + "-" + end);
  }
  if (portfolio) query = query.eq("portfolio", true);
  const [items, projects, opps, selected] = await Promise.all([
    query
      .order("publication_on", { nullsFirst: false })
      .order("title")
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
    ctx.db
      .from("projects")
      .select("id,name")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .order("name"),
    ctx.db
      .from("opportunities")
      .select("id,name")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .order("name"),
    filters.edit
      ? ctx.db
          .from("editorial_items")
          .select("*")
          .eq("organization_id", org)
          .eq("id", filters.edit)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (items.error || projects.error || opps.error || selected.error)
    throw Error("No se pudo cargar el calendario editorial.");
  const item = selected.data;
  const href = (p: number, id?: string) =>
    path +
    "?" +
    new URLSearchParams({
      month: month || "",
      portfolio: portfolio ? "1" : "",
      page: String(p),
      ...(id && { edit: id }),
    });
  return (
    <>
      <h1>Calendario editorial y portafolio</h1>
      <CommercialTabs active={path} />
      <form className="toolbar">
        <label>
          Mes de publicación
          <input type="month" name="month" defaultValue={month} />
        </label>
        <label>
          <input
            type="checkbox"
            name="portfolio"
            value="1"
            defaultChecked={portfolio}
          />{" "}
          Solo portafolio
        </label>
        <button className="button">Filtrar</button>
        <Link href={path}>Ver todo</Link>
      </form>
      <section className="panel padded">
        <h2>Agenda de contenido</h2>
        {!items.data.length && <p>Sin contenidos para esta selección.</p>}
        {items.data.map((i) => (
          <article key={i.id}>
            <h3>
              <Link href={href(page, i.id)}>{i.title}</Link>
            </h3>
            <p>
              {i.publication_on || "Sin fecha"} · {i.channel} ·{" "}
              {statuses[i.status as keyof typeof statuses]}{" "}
              {i.portfolio && "· Portafolio"}
            </p>
            {i.url && <a href={i.url}>Abrir publicación</a>}
            {i.results && <p>{i.results}</p>}
          </article>
        ))}
        {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
        {page * 30 < (items.count || 0) && (
          <Link href={href(page + 1)}>Siguiente</Link>
        )}
      </section>
      <h2>{item ? "Editar contenido" : "Registrar idea o publicación"}</h2>
      {item && <Link href={href(page)}>Crear otro contenido</Link>}
      <RecordForm
        key={item ? item.id + "-" + item.version : "new"}
        id={item?.id || crypto.randomUUID()}
        save={saveEditorial}
      >
        <input type="hidden" name="version" value={item?.version || 0} />
        <label>
          Título
          <input
            name="title"
            required
            minLength={2}
            maxLength={160}
            defaultValue={item?.title}
          />
        </label>
        <label>
          Canal
          <input
            name="channel"
            required
            maxLength={80}
            defaultValue={item?.channel}
          />
        </label>
        <label>
          Estado
          <select name="status" defaultValue={item?.status || "idea"}>
            {Object.entries(statuses).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha de publicación
          <input
            type="date"
            name="publication_on"
            defaultValue={item?.publication_on || ""}
          />
        </label>
        <label>
          Enlace
          <input type="url" name="url" defaultValue={item?.url} />
        </label>
        <label>
          Resultados
          <textarea
            name="results"
            maxLength={4000}
            defaultValue={item?.results}
          />
        </label>
        <label>
          Proyecto
          <select name="project_id" defaultValue={item?.project_id || ""}>
            <option value="">Sin proyecto</option>
            {item?.project_id &&
              !projects.data.some((p) => p.id === item.project_id) && (
                <option value={item.project_id}>Proyecto vinculado</option>
              )}
            {projects.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prospecto del pipeline
          <select
            name="opportunity_id"
            defaultValue={item?.opportunity_id || ""}
          >
            <option value="">Sin oportunidad</option>
            {item?.opportunity_id &&
              !opps.data.some((p) => p.id === item.opportunity_id) && (
                <option value={item.opportunity_id}>
                  Oportunidad vinculada
                </option>
              )}
            {opps.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            name="portfolio"
            defaultChecked={item?.portfolio}
          />{" "}
          Incluir en portafolio
        </label>
      </RecordForm>
    </>
  );
}

export const metadata = { title: "Marketing" };

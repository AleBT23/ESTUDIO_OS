import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import { cashAreas } from "@/modules/finance/area-cash";

const ages: Record<string, string> = {
  upcoming: "Por vencer",
  today: "Vence hoy",
  late_30: "Vencido de 1 a 30 días",
  late_60: "Vencido de 31 a 60 días",
  late_over_60: "Vencido más de 60 días",
  undated: "Sin fecha",
};
export default async function OpenObligations({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    edad?: string;
    sentido?: string;
    fondos?: string;
    area?: string;
  }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p>Permisos insuficientes.</p>;
  const f = await searchParams,
    page = Math.max(1, Math.min(10000, parseInt(f.page ?? "1") || 1));
  const filters = {
    edad: Object.hasOwn(ages, f.edad ?? "") ? f.edad! : "",
    sentido: ["in", "out"].includes(f.sentido ?? "") ? f.sentido! : "",
    fondos: ["propios", "administrados"].includes(f.fondos ?? "")
      ? f.fondos!
      : "",
    area: Object.hasOwn(cashAreas, f.area ?? "") ? f.area! : "",
  };
  let q = ctx.db
    .from("open_obligations")
    .select(
      "id,source,label,area,managed,project_id,direction,due_on,balance_cents,age_group",
      { count: "exact" },
    )
    .eq("organization_id", ctx.organization.id);
  if (filters.edad) q = q.eq("age_group", filters.edad);
  if (filters.sentido) q = q.eq("direction", filters.sentido);
  if (filters.fondos) q = q.eq("managed", filters.fondos === "administrados");
  if (filters.area) q = q.eq("area", filters.area);
  const { data, error, count } = await q
    .order("due_on", { ascending: true, nullsFirst: false })
    .order("source")
    .order("id")
    .order("direction")
    .range((page - 1) * 30, page * 30 - 1);
  const href = (n: number) =>
    "?" + new URLSearchParams({ ...filters, page: String(n) });
  return (
    <>
      <Link href="/administracion">Volver a Administración</Link>
      <header className="page-heading">
        <h1>Cartera por vencimiento</h1>
        <p>
          Saldos actuales por cobrar y por pagar, con la antigüedad calculada en
          la zona horaria del estudio.
        </p>
      </header>
      <form className="panel padded">
        <div className="form-grid">
          {(
            [
              ["edad", "Vencimiento", ages],
              ["sentido", "Obligación", { in: "Por cobrar", out: "Por pagar" }],
              [
                "fondos",
                "Fondos",
                { propios: "Propios", administrados: "Administrados" },
              ],
              ["area", "Área", cashAreas],
            ] as const
          ).map(([key, label, options]) => (
            <label key={key}>
              {label}
              <select name={key} defaultValue={filters[key]}>
                <option value="">Todos</option>
                {Object.entries(options).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button className="button button-primary">Aplicar filtros</button>
      </form>
      <section className="panel padded">
        {error ? (
          <p>No se pudo consultar la cartera.</p>
        ) : (
          <>
            {data.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Origen",
                        "Área y fondos",
                        "Obligación",
                        "Vencimiento",
                        "Antigüedad",
                        "Pendiente",
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={[row.source, row.id, row.direction].join("/")}>
                        <th>
                          <Link
                            href={
                              row.source === "schedule"
                                ? "/proyectos/" + row.project_id + "#cobros"
                                : "/administracion/operaciones/" + row.id
                            }
                          >
                            {row.label}
                          </Link>
                        </th>
                        <td>
                          {cashAreas[row.area as keyof typeof cashAreas]} ·{" "}
                          {row.managed ? "Administrados" : "Propios"}
                        </td>
                        <td>
                          {row.direction === "in" ? "Por cobrar" : "Por pagar"}
                        </td>
                        <td>{row.due_on ?? "—"}</td>
                        <td>{ages[row.age_group]}</td>
                        <td>{formatMoney(BigInt(row.balance_cents))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Sin saldos pendientes en esta selección.</p>
            )}
            <p>
              {count ?? 0} obligaciones · Página {page}
            </p>
            {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
            {page * 30 < (count ?? 0) && (
              <Link href={href(page + 1)}>Siguiente</Link>
            )}
          </>
        )}
      </section>
    </>
  );
}

export const metadata = { title: "Cartera por vencimiento" };

import { Journal } from "@/modules/journal/panel";
import Link from "next/link";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import { WorkBudget } from "@/modules/finance/work-budget";
import { workMetrics } from "@/modules/finance/work-report";
export default async function Works({
  searchParams,
}: {
  searchParams: Promise<{
    obra?: string;
    page?: string;
    partidas?: string;
    historial?: string;
  }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p className="notice">Permisos insuficientes.</p>;
  const q = await searchParams,
    org = ctx.organization.id;
  const id = z.uuid().safeParse(q.obra).success ? q.obra : undefined;
  const page = Math.max(1, Math.min(10000, parseInt(q.page ?? "1") || 1));
  const [works, current, balances] = await Promise.all([
    ctx.db
      .from("works")
      .select("id,name", { count: "exact" })
      .eq("organization_id", org)
      .order("name")
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
    id
      ? ctx.db
          .from("works")
          .select("name")
          .eq("organization_id", org)
          .eq("id", id)
          .maybeSingle()
      : null,
    id
      ? ctx.db
          .from("work_balances")
          .select("*")
          .eq("organization_id", org)
          .eq("work_id", id)
          .order("managed")
      : null,
  ]);
  if (works.error || current?.error || balances?.error)
    return (
      <p className="notice">
        No se pudieron cargar las obras. Verifica la conexión y las migraciones
        de obra.
      </p>
    );
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">CONTROL DE OBRA</p>
        <h1>Obras</h1>
        <Link href="/administracion/operaciones">Registrar obra o acuerdo</Link>
      </header>
      <section className="panel padded">
        <h2>Expedientes</h2>
        {works.data.length ? (
          <ul>
            {works.data.map((w) => (
              <li key={w.id}>
                <Link href={"?page=" + page + "&obra=" + w.id}>{w.name}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>Sin obras en esta página.</p>
        )}
        {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
        {page * 30 < (works.count ?? 0) && (
          <Link href={"?page=" + (page + 1)}>Siguiente</Link>
        )}
      </section>
      {id && current?.data && (
        <section className="panel padded">
          <h2>{current.data.name}</h2>
          {balances?.data?.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Indicador</th>
                    {balances.data.map((r) => (
                      <th key={String(r.managed)}>
                        {r.managed ? "Fondos administrados" : "Fondos propios"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {workMetrics.map(([key, label]) => (
                    <tr key={key}>
                      <th scope="row">{label}</th>
                      {balances.data.map((r) => (
                        <td key={String(r.managed)}>
                          {r[key] === null ? "—" : formatMoney(BigInt(r[key]))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Esta obra todavía no tiene acuerdos registrados.</p>
          )}
          <a
            className="button button-outline"
            href={"/api/obras/" + id + "/reporte"}
          >
            Exportar balance CSV
          </a>
          <a
            className="button button-outline"
            href={"/api/obras/" + id + "/reporte?detalle=partidas"}
          >
            Exportar avance por partida CSV
          </a>
        </section>
      )}
      {id && current?.data && (
        <WorkBudget
          id={id}
          page={Math.max(1, Math.min(10000, parseInt(q.partidas ?? "1") || 1))}
        />
      )}
      {id && current?.data && (
        <Journal
          scope="work"
          id={id}
          page={Math.max(1, Math.min(10000, parseInt(q.historial ?? "1") || 1))}
        />
      )}
    </>
  );
}

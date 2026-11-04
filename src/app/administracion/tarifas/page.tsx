import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import { RecordForm } from "@/shared/ui/record-form";
import { saveCostRate } from "@/modules/finance/cost-rate-action";
export default async function CostRates({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p>Permisos insuficientes.</p>;
  const page = Math.min(
      10000,
      Math.max(1, parseInt((await searchParams).page || "1") || 1),
    ),
    org = ctx.organization.id;
  const [members, rates] = await Promise.all([
    ctx.db
      .from("memberships")
      .select("user_id,role")
      .eq("organization_id", org)
      .order("user_id"),
    ctx.db
      .from("member_cost_rates")
      .select("id,member_id,effective_on,hourly_cents", { count: "exact" })
      .eq("organization_id", org)
      .order("effective_on", { ascending: false })
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
  ]);
  if (members.error || rates.error)
    return <p>No se pudieron consultar las tarifas internas.</p>;
  const name = (id: string) =>
    id === ctx.user.id ? "Mi cuenta" : "Miembro " + id.slice(0, 8);
  return (
    <>
      <Link href="/administracion/reportes">Volver a reportes</Link>
      <header className="page-heading">
        <h1>Tarifas de costo interno</h1>
        <p>
          Cada registro de tiempo usa la tarifa vigente en la fecha trabajada.
          Una vigencia retroactiva recalcula los reportes desde esa fecha hasta
          la siguiente tarifa.
        </p>
      </header>
      <details>
        <summary>Registrar tarifa por hora</summary>
        <RecordForm id={crypto.randomUUID()} save={saveCostRate}>
          <label>
            Miembro
            <select name="member_id" required>
              {members.data.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {name(m.user_id)} · {m.role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Vigente desde
            <input type="date" name="effective_on" required />
          </label>
          <label>
            Costo por hora MXN
            <input
              type="number"
              min="0"
              step=".01"
              name="hourly_cents"
              required
            />
          </label>
        </RecordForm>
      </details>
      <section className="panel padded">
        <h2>Historial de tarifas</h2>
        {!rates.data.length && <p>Sin tarifas en esta página.</p>}
        {rates.data.map((r) => (
          <p key={r.id}>
            {name(r.member_id)} · Desde {r.effective_on} ·{" "}
            {formatMoney(r.hourly_cents)} por hora
          </p>
        ))}
        {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
        {page * 30 < (rates.count ?? 0) && (
          <Link href={"?page=" + (page + 1)}>Siguiente</Link>
        )}
      </section>
    </>
  );
}

export const metadata = { title: "Tarifas del equipo" };

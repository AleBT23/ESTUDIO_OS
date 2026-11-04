import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import { OperationForm } from "./operation-form";
export async function WorkBudget({ id, page }: { id: string; page: number }) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role)) return null;
  const [items, total] = await Promise.all([
    ctx.db
      .from("work_budget_items")
      .select(
        "id,chapter,description,quantity,unit,unit_price_cents,total:total_cents::text",
        { count: "exact" },
      )
      .eq("organization_id", ctx.organization.id)
      .eq("work_id", id)
      .order("chapter")
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
    ctx.db
      .from("work_budget_totals")
      .select("base_cents")
      .eq("organization_id", ctx.organization.id)
      .eq("work_id", id)
      .maybeSingle(),
  ]);
  if (items.error || total.error)
    return <p className="notice">No se pudo consultar el presupuesto base.</p>;
  const href = (n: number) =>
    "/obras?obra=" + id + "&partidas=" + n + "#presupuesto";
  return (
    <section className="panel padded" id="presupuesto">
      <h2>Presupuesto base</h2>
      <p>
        Total presupuestado ·{" "}
        {formatMoney(BigInt(total.data?.base_cents ?? "0"))}
      </p>
      {items.data.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Capítulo",
                  "Partida",
                  "Cantidad",
                  "Unidad",
                  "Precio unitario",
                  "Importe",
                ].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.data.map((r) => (
                <tr key={r.id}>
                  <td>{r.chapter}</td>
                  <td>
                    <Link href={"/obras/partidas/" + r.id}>
                      {r.description}
                    </Link>
                  </td>
                  <td>{r.quantity}</td>
                  <td>{r.unit}</td>
                  <td>{formatMoney(r.unit_price_cents)}</td>
                  <td>{formatMoney(BigInt(r.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Sin partidas en esta página.</p>
      )}
      {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
      {page * 30 < (items.count ?? 0) && (
        <Link href={href(page + 1)}>Siguiente</Link>
      )}
      <details>
        <summary>Agregar partida al presupuesto</summary>
        <OperationForm kind="budget" id={crypto.randomUUID()}>
          <input type="hidden" name="work_id" value={id} />
          <label>
            Capítulo
            <input name="chapter" maxLength={100} required />
          </label>
          <label>
            Concepto
            <input name="description" maxLength={300} required />
          </label>
          <label>
            Unidad
            <input name="unit" maxLength={25} required />
          </label>
          <label>
            Cantidad
            <input
              type="number"
              name="quantity"
              min=".0001"
              step=".0001"
              required
            />
          </label>
          <label>
            Precio unitario MXN
            <input
              name="unit_price_cents"
              type="number"
              min="0"
              step=".01"
              required
            />
          </label>
        </OperationForm>
      </details>
    </section>
  );
}

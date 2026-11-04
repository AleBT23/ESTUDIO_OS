import { ResourceUsage } from "@/modules/finance/resource-usage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import { RecordForm } from "@/shared/ui/record-form";
import { saveEstimate } from "@/modules/finance/estimate-action";
export default async function Item({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; recurso?: string; consumos?: string }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p className="notice">Permisos insuficientes.</p>;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const filters = await searchParams;
  const page = Math.max(1, Math.min(10000, parseInt(filters.page ?? "1") || 1));
  const org = ctx.organization.id;
  const [item, entries] = await Promise.all([
    ctx.db
      .from("work_item_progress")
      .select("id,work_id,chapter,description,unit,quantity,measured,remaining,budget,earned,outstanding")
      .eq("organization_id", org)
      .eq("id", id)
      .maybeSingle(),
    ctx.db
      .from("work_estimates")
      .select("id,measured_on,quantity,amount:amount_cents::text,notes", {
        count: "exact",
      })
      .eq("organization_id", org)
      .eq("item_id", id)
      .order("measured_on", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
  ]);
  if (item.error || entries.error)
    return <p className="notice">No se pudo consultar la estimación.</p>;
  const r = item.data;
  if (!r) notFound();
  return (
    <>
      <Link href={"/obras?obra=" + r.work_id + "#presupuesto"}>
        Volver al presupuesto
      </Link>
      <header className="page-heading">
        <p className="eyebrow">{r.chapter}</p>
        <h1>{r.description}</h1>
        <p>
          Estimado {r.measured} de {r.quantity} {r.unit} · Pendiente{" "}
          {r.remaining} {r.unit}
        </p>
        <dl>
          <dt>Presupuesto</dt><dd>{formatMoney(BigInt(r.budget))}</dd>
          <dt>Avance estimado</dt><dd>{formatMoney(BigInt(r.earned))}</dd>
          <dt>Pendiente de estimar</dt><dd>{formatMoney(BigInt(r.outstanding))}</dd>
        </dl>
      </header>
      {Number(r.remaining) > 0 && (
        <details>
          <summary>Registrar estimación de avance</summary>
          <RecordForm id={crypto.randomUUID()} save={saveEstimate}>
            <input type="hidden" name="work_id" value={r.work_id} />
            <input type="hidden" name="item_id" value={id} />
            <label>
              Fecha de medición
              <input type="date" name="measured_on" required />
            </label>
            <label>
              Cantidad ejecutada ({r.unit})
              <input
                type="number"
                min=".0001"
                max={r.remaining}
                step=".0001"
                name="quantity"
                required
              />
            </label>
            <label>
              Observaciones
              <textarea name="notes" maxLength={2000} />
            </label>
          </RecordForm>
        </details>
      )}
      <section className="panel padded">
        <h2>Estimaciones de la partida</h2>
        {entries.data.length ? (
          entries.data.map((e) => (
            <article className="activity-row" key={e.id}>
              <strong>
                {e.measured_on} · {e.quantity} {r.unit} ·{" "}
                {formatMoney(BigInt(e.amount))}
              </strong>
              <p>{e.notes}</p>
            </article>
          ))
        ) : (
          <p>Sin estimaciones en esta página.</p>
        )}
        {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
        {page * 30 < (entries.count ?? 0) && (
          <Link href={"?page=" + (page + 1)}>Siguiente</Link>
        )}
      </section>
      <ResourceUsage
        item={id}
        work={r.work_id}
        category={filters.recurso}
        page={Math.max(
          1,
          Math.min(10000, parseInt(filters.consumos ?? "1") || 1),
        )}
      />
    </>
  );
}

export const metadata = { title: "Partida de obra" };

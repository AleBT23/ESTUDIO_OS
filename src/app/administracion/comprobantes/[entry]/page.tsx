import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import { RecordForm } from "@/shared/ui/record-form";
import { attachReceipt } from "@/modules/finance/receipt-action";
export default async function Receipts({
  params,
  searchParams,
}: {
  params: Promise<{ entry: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p className="notice">Permisos insuficientes.</p>;
  const { entry } = await params;
  if (!z.uuid().safeParse(entry).success) notFound();
  const org = ctx.organization.id,
    page = Math.max(
      1,
      Math.min(10000, parseInt((await searchParams).page ?? "1") || 1),
    );
  const [movement, list] = await Promise.all([
    ctx.db
      .from("finance_entries")
      .select("case_id,amount_cents,direction,paid_on")
      .eq("organization_id", org)
      .eq("id", entry)
      .maybeSingle(),
    ctx.db
      .from("available_receipts")
      .select("id,filename,size_bytes", { count: "exact" })
      .eq("organization_id", org)
      .eq("entry_id", entry)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 20, page * 20 - 1),
  ]);
  if (movement.error || list.error)
    return <p className="notice">No se pudieron consultar los comprobantes.</p>;
  if (!movement.data) notFound();
  const m = movement.data;
  return (
    <>
      <Link href={"/administracion/operaciones/" + m.case_id}>
        Volver al acuerdo
      </Link>
      <header className="page-heading">
        <h1>Comprobantes del movimiento</h1>
        <p>
          {m.direction === "in" ? "Cobro" : "Pago"} · {m.paid_on} ·{" "}
          {formatMoney(m.amount_cents)}
        </p>
      </header>
      <section className="panel padded">
        <h2>Archivos privados</h2>
        {list.data.length ? (
          <ul>
            {list.data.map((r) => (
              <li key={r.id}>
                <a href={"/api/comprobantes/" + r.id}>{r.filename}</a> ·{" "}
                {Math.ceil(r.size_bytes / 1024)} KiB
              </li>
            ))}
          </ul>
        ) : (
          <p>Sin comprobantes en esta página.</p>
        )}
        {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
        {page * 20 < (list.count ?? 0) && (
          <Link href={"?page=" + (page + 1)}>Siguiente</Link>
        )}
      </section>
      <RecordForm id={crypto.randomUUID()} save={attachReceipt}>
        <input type="hidden" name="case_id" value={m.case_id} />
        <input type="hidden" name="entry_id" value={entry} />
        <label>
          Adjuntar comprobante (PDF, JPEG o PNG de hasta 2 MiB)
          <input
            type="file"
            name="receipt"
            required
            accept="application/pdf,image/png,image/jpeg"
          />
        </label>
      </RecordForm>
    </>
  );
}

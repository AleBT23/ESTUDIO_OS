import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import { OperationForm } from "./operation-form";
export async function CaseInvoices({ id, page }: { id: string; page: number }) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role)) return null;
  const [rows, total] = await Promise.all([
    ctx.db
      .from("case_invoices")
      .select("id,reference,issued_on,amount_cents", { count: "exact" })
      .eq("organization_id", ctx.organization.id)
      .eq("case_id", id)
      .order("issued_on", { ascending: false })
      .order("id")
      .range((page - 1) * 25, page * 25 - 1),
    ctx.db
      .from("case_invoice_totals")
      .select("invoiced_cents")
      .eq("organization_id", ctx.organization.id)
      .eq("case_id", id)
      .maybeSingle(),
  ]);
  if (rows.error || total.error)
    return (
      <p className="notice">No se pudo consultar la facturación del acuerdo.</p>
    );
  return (
    <section id="facturas" className="panel padded">
      <h2>Facturas emitidas</h2>
      <p>
        Total facturado ·{" "}
        {formatMoney(BigInt(total.data?.invoiced_cents ?? "0"))}
      </p>
      {rows.data.length ? (
        <ul>
          {rows.data.map((r) => (
            <li key={r.id}>
              {r.issued_on} · {r.reference} · {formatMoney(r.amount_cents)}
            </li>
          ))}
        </ul>
      ) : (
        <p>Sin facturas en esta página.</p>
      )}
      {page > 1 && (
        <Link href={"?facturas=" + (page - 1) + "#facturas"}>Anterior </Link>
      )}
      {page * 25 < (rows.count ?? 0) && (
        <Link href={"?facturas=" + (page + 1) + "#facturas"}>Siguiente</Link>
      )}
      <details>
        <summary>Registrar factura ya emitida</summary>
        <OperationForm kind="invoice" id={crypto.randomUUID()}>
          <input type="hidden" name="case_id" value={id} />
          <label>
            Serie y folio o UUID
            <input name="reference" maxLength={120} required />
          </label>
          <label>
            Fecha de emisión
            <input type="date" name="issued_on" required />
          </label>
          <label>
            Importe facturado MXN
            <input
              name="amount_cents"
              type="number"
              min=".01"
              step=".01"
              required
            />
          </label>
        </OperationForm>
      </details>
    </section>
  );
}

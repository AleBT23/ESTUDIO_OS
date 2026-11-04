import { RecordForm } from "@/shared/ui/record-form";
import { saveAgreementDates } from "@/modules/finance/agreement-dates";
import { CaseInvoices } from "@/modules/finance/case-invoices";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import {
  ReverseEntryForm,
  OperationForm,
} from "@/modules/finance/operation-form";
export default async function Operation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; facturas?: string }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p className="notice">Permisos insuficientes.</p>;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const page = Math.max(
    1,
    Math.min(10000, parseInt((await searchParams).page ?? "1") || 1),
  );
  const [account, dates, history] = await Promise.all([
    ctx.db
      .from("finance_case_balances")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .eq("id", id)
      .maybeSingle(),
    ctx.db
      .from("finance_cases")
      .select("collect_on,pay_on")
      .eq("organization_id", ctx.organization.id)
      .eq("id", id)
      .maybeSingle(),
    ctx.db
      .from("finance_entries")
      .select("*", { count: "exact" })
      .eq("organization_id", ctx.organization.id)
      .eq("case_id", id)
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
  ]);
  if (account.error || dates.error || history.error)
    throw new Error("No se pudo cargar el acuerdo.");
  const r = account.data;
  if (!r) notFound();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.organization.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <>
      <Link href="/administracion/operaciones">Volver a operaciones</Link>
      <header className="page-heading">
        <p className="eyebrow">
          {r.managed ? "FONDOS ADMINISTRADOS" : "FONDOS PROPIOS"}
        </p>
        <h1>{r.name}</h1>
        {r.provider && <p>Proveedor · {r.provider}</p>}
      </header>
      <section className="panel padded">
        <h2>Balance del acuerdo</h2>
        <dl>
          {Object.entries({
            "Ingreso acordado": r.revenue_cents,
            "Costo comprometido": r.cost_cents,
            Cobrado: r.received_cents,
            Pagado: r.paid_cents,
            "Por cobrar": r.receivable_cents,
            "Por pagar": r.payable_cents,
            "Flujo neto": r.cash_cents,
            ...(r.managed
              ? {}
              : { "Margen previsto": r.expected_margin_cents }),
          }).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{formatMoney(Number(v))}</dd>
            </div>
          ))}
        </dl>
      </section>
      {dates.data && (
        <details>
          <summary>Vencimientos de cobro y pago</summary>
          <p>
            Las fechas generan avisos en Agenda mientras quede saldo pendiente.
          </p>
          <RecordForm
            key={[id, dates.data.collect_on, dates.data.pay_on].join("/")}
            id={id}
            save={saveAgreementDates}
          >
            {(["collect_on", "pay_on"] as const).map((key) => (
              <div key={key}>
                <input
                  type="hidden"
                  name={"original_" + key}
                  value={dates.data?.[key] ?? ""}
                />
                <label>
                  {key === "collect_on"
                    ? "Fecha prevista de cobro"
                    : "Fecha prevista de pago"}
                  <input
                    name={key}
                    type="date"
                    defaultValue={dates.data?.[key] ?? ""}
                    disabled={
                      !(key === "collect_on" ? r.revenue_cents : r.cost_cents)
                    }
                  />
                </label>
              </div>
            ))}
          </RecordForm>
        </details>
      )}
      {(r.receivable_cents > 0 || r.payable_cents > 0) && (
        <>
          <h2>Registrar movimiento efectivo</h2>
          <OperationForm kind="entry" id={crypto.randomUUID()}>
            <input type="hidden" name="case_id" value={id} />
            <label>
              Movimiento
              <select name="direction">
                {r.receivable_cents > 0 && <option value="in">Cobro</option>}
                {r.payable_cents > 0 && <option value="out">Pago</option>}
              </select>
            </label>
            <label>
              Importe MXN
              <input
                type="number"
                min=".01"
                step=".01"
                name="amount_cents"
                required
              />
            </label>
            <label>
              Fecha
              <input
                type="date"
                name="paid_on"
                max={today}
                defaultValue={today}
                required
              />
            </label>
            <label>
              <input type="checkbox" name="advance" />
              Anticipo aplicado al acuerdo
            </label>
          </OperationForm>
        </>
      )}
      <section className="panel padded">
        <h2>Historial</h2>
        {history.data.length ? (
          history.data.map((e) => (
            <div key={e.id}>
              <p>
                {e.paid_on} · {e.direction === "in" ? "Cobro" : "Pago"}
                {e.advance ? " anticipado" : ""} · {formatMoney(e.amount_cents)}
              </p>
              <a href={"/api/recibos/" + e.id + "?origen=acuerdo"}>
                Descargar recibo PDF
              </a>
              <Link href={"/administracion/comprobantes/" + e.id}>
                Ver o adjuntar comprobantes
              </Link>
              {e.reversed_at ? (
                <p>Revertido · {e.reversal_reason}</p>
              ) : (
                <ReverseEntryForm id={e.id} />
              )}
            </div>
          ))
        ) : (
          <p>Sin movimientos en esta página.</p>
        )}
        {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
        {page * 30 < (history.count ?? 0) && (
          <Link href={"?page=" + (page + 1)}>Siguiente</Link>
        )}
      </section>
      <CaseInvoices
        id={id}
        page={Math.max(
          1,
          Math.min(10000, parseInt((await searchParams).facturas ?? "1") || 1),
        )}
      />
    </>
  );
}

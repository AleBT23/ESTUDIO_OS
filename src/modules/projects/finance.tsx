import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import {
  PaymentForm,
  ReversePaymentForm,
} from "@/modules/finance/payment-forms";
import { AmountForm } from "./forms";
import { projectWorkspaceReady } from "./availability";
export async function ProjectFinance({
  project,
  name,
  version,
  manual,
  page = 1,
}: {
  project: string;
  name: string;
  version: number;
  manual: boolean;
  page?: number;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role)) return null;
  if (!(await projectWorkspaceReady()))
    return (
      <section className="panel padded">
        <h2>Cobros del proyecto</h2>
        <Link className="text-link" href="/administracion">
          Consultar importes y registrar anticipos en Administración →
        </Link>
      </section>
    );
  const [summary, plans, payments] = await Promise.all([
    ctx.db
      .from("project_financial_summary")
      .select("amount_cents,collected_cents,balance_cents,schedule_count")
      .eq("organization_id", ctx.organization.id)
      .eq("project_id", project)
      .maybeSingle(),
    ctx.db
      .from("payment_schedule_balances")
      .select("id,label,due_date,amount_cents,collected_cents,balance_cents")
      .eq("organization_id", ctx.organization.id)
      .eq("project_id", project)
      .order("due_date")
      .limit(500),
    ctx.db
      .from("payments")
      .select(
        "id,amount_cents,paid_on,reference,state,version,reversal_reason,payment_schedules!inner(project_id)",
        { count: "exact" },
      )
      .eq("organization_id", ctx.organization.id)
      .eq("payment_schedules.project_id", project)
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range((page - 1) * 30, page * 30 - 1),
  ]);
  if (summary.error || plans.error || payments.error)
    throw new Error("No se pudo cargar el historial económico del proyecto.");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.organization.timezone,
  }).format(new Date());
  return (
    <section className="project-stack" id="cobros">
      <div className="panel padded">
        <h2>Importe del proyecto y anticipos</h2>
        <p className="muted">
          El importe acordado con el cliente y los pagos realmente recibidos,
          con sus fechas. No representa costo interno ni utilidad.
        </p>
        <dl className="finance-summary">
          <div>
            <dt>Importe acordado MXN</dt>
            <dd>
              {summary.data
                ? formatMoney(summary.data.amount_cents)
                : "Sin definir"}
            </dd>
          </div>
          <div>
            <dt>Recibido MXN</dt>
            <dd>{formatMoney(summary.data?.collected_cents || 0)}</dd>
          </div>
          <div>
            <dt>Saldo por recibir MXN</dt>
            <dd>
              {summary.data
                ? formatMoney(summary.data.balance_cents)
                : "Sin definir"}
            </dd>
          </div>
        </dl>
        {!summary.data && manual && (
          <AmountForm project={project} version={version} today={today} />
        )}
        <details>
          <summary>Ver el plan de cobro</summary>
          {plans.data?.map((plan) => (
            <div className="activity-row" key={plan.id}>
              <strong>
                {plan.label} · {formatMoney(plan.amount_cents)}
              </strong>
              <p className="caption">
                Fecha prevista {plan.due_date} · Recibido{" "}
                {formatMoney(plan.collected_cents)} · Saldo{" "}
                {formatMoney(plan.balance_cents)}
              </p>
            </div>
          ))}
          {Number(summary.data?.schedule_count || 0) > 500 && (
            <p className="notice">
              Se muestran las primeras 500 obligaciones; los totales incluyen
              todas.
            </p>
          )}
        </details>
      </div>
      <PaymentForm
        plans={(plans.data || [])
          .filter((p) => p.balance_cents > 0)
          .map((p) => ({ ...p, project_name: name }))}
        today={today}
        requestId={crypto.randomUUID()}
      />
      <div className="panel padded">
        <h2>Historial de anticipos y pagos</h2>
        {payments.data?.map((payment) => (
          <div className="payment-row" key={payment.id}>
            <div>
              <strong>{formatMoney(payment.amount_cents)}</strong>
              <p>
                {payment.paid_on} · {payment.reference || "Sin referencia"}
              </p>
              <span className="tag">
                {payment.state === "posted" ? "Recibido" : "Revertido"}
              </span>
              {payment.reversal_reason && (
                <p className="caption">{payment.reversal_reason}</p>
              )}
            </div>
            {payment.state === "posted" && (
              <ReversePaymentForm id={payment.id} version={payment.version} />
            )}
          </div>
        ))}
        {!payments.data?.length && (
          <p className="muted">
            Todavía no hay pagos en esta página. Programar un anticipo no
            significa haberlo recibido.
          </p>
        )}
        <div className="form-actions">
          <span className="caption">
            {payments.count || 0} movimientos · Página {page}
          </span>
          {page > 1 && (
            <Link
              className="button button-outline"
              href={`/proyectos/${project}?payments=${page - 1}#cobros`}
            >
              Anteriores
            </Link>
          )}
          {page * 30 < (payments.count || 0) && (
            <Link
              className="button button-outline"
              href={`/proyectos/${project}?payments=${page + 1}#cobros`}
            >
              Siguientes
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

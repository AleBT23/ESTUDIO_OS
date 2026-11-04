import { SchedulePaymentForm } from "@/modules/finance/schedule-payment-form";
import { ReplanForm } from "@/modules/finance/replan-form";
import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import { ReversePaymentForm } from "@/modules/finance/payment-forms";
import { AmountForm } from "./forms";
import { projectWorkspaceReady } from "./availability";
export async function ProjectFinance({
  project,
  name,
  version,
  manual,
  page = 1,
  planPage,
  showPlans,
  change,
}: {
  project: string;
  name: string;
  version: number;
  manual: boolean;
  page?: number;
  planPage: number;
  showPlans: boolean;
  change?: string;
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
  const planQuery = ctx.db
    .from("project_schedule_details")
    .select(
      "id,label,due_date,change_description,amount_text:amount_cents::text,collected_text:collected_cents::text,balance_text:balance_cents::text",
      { count: "exact" },
    )
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", project);
  const historyQuery = ctx.db
    .from("project_payment_history")
    .select(
      "id,amount_cents,paid_on,reference,state,version,reversal_reason,package_name",
      { count: "exact" },
    )
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", project);
  const planLink = (n: number) =>
    `?planes=${n}&payments=${page}${change ? "&ampliacion=" + change : ""}#plan-cobro`;
  const [summary, plans, payments] = await Promise.all([
    ctx.db
      .from("project_financial_summary")
      .select(
        "amount_cents::text,collected_cents::text,balance_cents::text,schedule_count",
      )
      .eq("organization_id", ctx.organization.id)
      .eq("project_id", project)
      .maybeSingle(),
    (change ? planQuery.eq("scope_change_id", change) : planQuery)
      .order("due_date")
      .order("id")
      .range((planPage - 1) * 30, planPage * 30 - 1),
    (change ? historyQuery.eq("scope_change_id", change) : historyQuery)
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
                ? formatMoney(BigInt(summary.data.amount_cents))
                : "Sin definir"}
            </dd>
          </div>
          <div>
            <dt>Recibido MXN</dt>
            <dd>{formatMoney(BigInt(summary.data?.collected_cents ?? 0))}</dd>
          </div>
          <div>
            <dt>Saldo por recibir MXN</dt>
            <dd>
              {summary.data
                ? formatMoney(BigInt(summary.data.balance_cents))
                : "Sin definir"}
            </dd>
          </div>
        </dl>
        {!summary.data && manual && (
          <AmountForm project={project} version={version} today={today} />
        )}
        <details id="plan-cobro" open={!!change || showPlans}>
          <summary>Ver el plan de cobro</summary>
          {change && (
            <p>
              Obligaciones de la ampliación seleccionada.{" "}
              <Link href="?planes=1#plan-cobro">Ver todos los planes</Link>
            </p>
          )}
          {plans.data?.map((plan) => (
            <div className="activity-row" key={plan.id}>
              <strong>
                {plan.label} · {formatMoney(BigInt(plan.amount_text))}
              </strong>
              <p className="caption">
                {plan.change_description
                  ? "Ampliación · " + plan.change_description
                  : "Contrato base"}
                <br />
                Fecha prevista {plan.due_date} · Recibido{" "}
                {formatMoney(BigInt(plan.collected_text))} · Saldo{" "}
                {formatMoney(BigInt(plan.balance_text))}
              </p>
              {BigInt(plan.balance_text) > 0n && <ReplanForm plan={plan} />}
            </div>
          ))}
          <p>
            {plans.count ?? 0} obligaciones · Página {planPage}
          </p>
          {planPage > 1 && (
            <Link href={planLink(planPage - 1)}>Planes anteriores </Link>
          )}
          {planPage * 30 < (plans.count ?? 0) && (
            <Link href={planLink(planPage + 1)}>Planes siguientes</Link>
          )}
        </details>
      </div>
      <SchedulePaymentForm
        key={`${change ?? "todos"}-${planPage}`}
        plans={(plans.data || [])
          .filter((p) => BigInt(p.balance_text) > 0n)
          .map((p) => ({
            ...p,
            project_name: name,
            label: [
              p.label,
              p.change_description || "Contrato base",
              p.due_date,
            ].join(" · "),
          }))}
        today={today}
        requestId={crypto.randomUUID()}
      />
      <div className="panel padded">
        <h2 id="historial-cobros">
          {change
            ? "Historial de cobros de esta ampliación"
            : "Historial de anticipos y pagos"}
        </h2>
        {payments.data?.map((payment) => (
          <div className="payment-row" key={payment.id}>
            <div>
              <strong>{formatMoney(payment.amount_cents)}</strong>
              <p>
                {payment.paid_on} · {payment.reference || "Sin referencia"} ·{" "}
                {payment.package_name ?? "Sin paquete asignado"}
              </p>
              <span className="tag">
                {payment.state === "posted" ? "Recibido" : "Revertido"}
              </span>
              <a href={"/api/recibos/" + payment.id + "?origen=proyecto"}>
                Descargar recibo PDF
              </a>
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
              href={`/proyectos/${project}?payments=${page - 1}&planes=${planPage}${change ? "&ampliacion=" + change : ""}#historial-cobros`}
            >
              Anteriores
            </Link>
          )}
          {page * 30 < (payments.count || 0) && (
            <Link
              className="button button-outline"
              href={`/proyectos/${project}?payments=${page + 1}&planes=${planPage}${change ? "&ampliacion=" + change : ""}#historial-cobros`}
            >
              Siguientes
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { Wallet } from "lucide-react";
import { getContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import {
  PaymentForm,
  ReversePaymentForm,
} from "@/modules/finance/payment-forms";
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; history?: string }>;
}) {
  const ctx = await getContext();
  const filter = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(filter.page || "1") || 1),
  );
  const historyPage = Math.max(
    1,
    Math.min(10000, Number.parseInt(filter.history || "1") || 1),
  );
  const heading = (
    <div className="page-heading">
      <p className="eyebrow">NÚMEROS CON CONTEXTO</p>
      <h1>Administración</h1>
      <p>Claridad en lo contratado, lo cobrado y lo invertido.</p>
    </div>
  );
  if (!ctx?.organization || !ctx.membership)
    return (
      <>
        {heading}
        <section className="panel empty-state">
          <Wallet size={32} />
          <h2>Cobros claros desde el primer acuerdo</h2>
          <p>
            Conecta tu estudio para consultar obligaciones de pago y registrar
            movimientos efectivos.
          </p>
          <Link className="button button-primary" href="/configuracion">
            Conectar mi estudio
          </Link>
        </section>
      </>
    );
  if (!canReadFinance(ctx.membership.role))
    return (
      <>
        {heading}
        <p className="notice">
          Tu rol no permite consultar información financiera. Solicita acceso al
          propietario del estudio.
        </p>
      </>
    );
  const [plansResult, paymentsResult, projectsResult] = await Promise.all([
    ctx.db
      .from("payment_schedule_balances")
      .select("*", { count: "exact" })
      .eq("organization_id", ctx.organization.id)
      .order("due_date")
      .range((page - 1) * 30, page * 30 - 1),
    ctx.db
      .from("payments")
      .select(
        "id,schedule_id,amount_cents,paid_on,reference,state,version,reversal_reason",
        { count: "exact" },
      )
      .eq("organization_id", ctx.organization.id)
      .order("created_at", { ascending: false })
      .range((historyPage - 1) * 30, historyPage * 30 - 1),
    ctx.db
      .from("projects")
      .select("id,name")
      .eq("organization_id", ctx.organization.id)
      .limit(1000),
  ]);
  if (plansResult.error || paymentsResult.error || projectsResult.error)
    throw new Error("No se pudo consultar el expediente de cobros.");
  const plans = plansResult.data || [];
  const projectName = (id: string) =>
    projectsResult.data?.find((p) => p.id === id)?.name ||
    "Proyecto fuera del rango del listado";
  const pending = plans
    .filter((p) => p.balance_cents > 0)
    .map((p) => ({ ...p, project_name: projectName(p.project_id) }));
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ctx.organization.timezone,
  }).format(new Date());
  return (
    <>
      {heading}
      <nav className="tabs" aria-label="Administración">
        <span className="selected">Planes y cobros</span>
        <span className="planned">Gastos · pendiente</span>
        <span className="planned">Colaboradores · pendiente</span>
        <span className="planned">Tiempo · pendiente</span>
        <span className="planned">Rentabilidad · pendiente</span>
      </nav>
      <section className="panel padded">
        <h2>Obligaciones de pago</h2>
        {plans.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Proyecto / concepto</th>
                  <th>Fecha prevista</th>
                  <th>Programado</th>
                  <th>Cobrado</th>
                  <th>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td>
                      <Link href={`/proyectos/${plan.project_id}`}>
                        {projectName(plan.project_id)}
                      </Link>
                      <small className="caption" style={{ display: "block" }}>
                        {plan.label}
                      </small>
                    </td>
                    <td>{plan.due_date}</td>
                    <td>{formatMoney(plan.amount_cents)}</td>
                    <td>{formatMoney(plan.collected_cents)}</td>
                    <td>{formatMoney(plan.balance_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">
            Los planes aparecerán al aceptar una cotización emitida.
          </p>
        )}
        <div className="form-actions">
          {page > 1 && (
            <Link
              className="button button-outline"
              href={`/administracion?page=${page - 1}&history=${historyPage}`}
            >
              Anterior
            </Link>
          )}
          <span className="caption">
            Página {page} · {plansResult.count || 0} obligaciones
          </span>
          {page * 30 < (plansResult.count || 0) && (
            <Link
              className="button button-outline"
              href={`/administracion?page=${page + 1}&history=${historyPage}`}
            >
              Siguiente
            </Link>
          )}
        </div>
      </section>
      <div style={{ marginTop: 24 }}>
        <PaymentForm
          plans={pending}
          today={today}
          requestId={crypto.randomUUID()}
        />
      </div>
      <section className="panel padded" style={{ marginTop: 24 }}>
        <h2>Movimientos efectivos</h2>
        {paymentsResult.data?.map((payment) => (
          <div className="payment-row" key={payment.id}>
            <div>
              <strong>{formatMoney(payment.amount_cents)}</strong>
              <span className="tag" style={{ marginLeft: 12 }}>
                {payment.state === "posted" ? "Cobrado" : "Revertido"}
              </span>
              <p className="caption" style={{ marginTop: 7 }}>
                {payment.paid_on} · {payment.reference || "Sin referencia"}
              </p>
              {payment.reversal_reason && (
                <p className="caption">Motivo: {payment.reversal_reason}</p>
              )}
            </div>
            {payment.state === "posted" && (
              <ReversePaymentForm id={payment.id} version={payment.version} />
            )}
          </div>
        ))}
        {!paymentsResult.data?.length && (
          <p className="muted">
            Todavía no se ha registrado ningún pago efectivo.
          </p>
        )}
        <div className="form-actions">
          {historyPage > 1 && (
            <Link
              className="button button-outline"
              href={`/administracion?page=${page}&history=${historyPage - 1}`}
            >
              Anteriores
            </Link>
          )}
          <span className="caption">
            Página {historyPage} · {paymentsResult.count || 0} movimientos
          </span>
          {historyPage * 30 < (paymentsResult.count || 0) && (
            <Link
              className="button button-outline"
              href={`/administracion?page=${page}&history=${historyPage + 1}`}
            >
              Siguientes
            </Link>
          )}
        </div>
      </section>
      <p className="notice" style={{ marginTop: 24 }}>
        Gastos, repartos, tiempo, rentabilidad y reportes aún no están
        implementados. Estos cobros no representan la utilidad del estudio.
      </p>
    </>
  );
}

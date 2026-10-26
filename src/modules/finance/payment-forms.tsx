"use client";
import { useActionState, useState } from "react";
import { Button } from "@/shared/ui/button";
import { formatMoney } from "@/shared/money";
import { recordPayment, reversePayment } from "./actions";
export function PaymentForm({
  plans,
  today,
  requestId,
}: {
  plans: {
    id: string;
    label: string;
    balance_cents: number;
    project_name: string;
  }[];
  today: string;
  requestId: string;
}) {
  const [fields, setFields] = useState({
    schedule: "",
    amount: "",
    date: today,
    reference: "",
  });
  const [loadedRequest, setLoadedRequest] = useState(requestId);
  const [state, action, pending] = useActionState(
    async (prev: { error?: string; success?: string }, form: FormData) => {
      const result = await recordPayment(prev, form);
      if (result.success) {
        setFields((current) => ({
          ...current,
          schedule: "",
          amount: "",
          reference: "",
        }));
        if (result.requestId) setLoadedRequest(result.requestId);
      }
      return result;
    },
    {} as { error?: string; success?: string },
  );
  return (
    <form
      action={action}
      className="panel padded"
      data-dirty={!!fields.amount || !!fields.reference}
    >
      <h2>Registrar un pago recibido</h2>
      <p className="muted">
        Captura únicamente un movimiento efectivo; el plan por sí solo no
        acredita el cobro.
      </p>
      <input type="hidden" name="request_id" value={loadedRequest} />
      <div className="form-grid">
        <label className="full">
          Obligación de pago
          <select
            name="schedule"
            required
            value={fields.schedule}
            onChange={(e) => setFields({ ...fields, schedule: e.target.value })}
          >
            <option value="">Seleccionar…</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.project_name} · {plan.label} · Pendiente{" "}
                {formatMoney(plan.balance_cents)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Importe recibido MXN
          <input
            name="amount"
            value={fields.amount}
            onChange={(e) => setFields({ ...fields, amount: e.target.value })}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
          />
        </label>
        <label>
          Fecha efectiva
          <input
            type="date"
            name="date"
            required
            max={today}
            value={fields.date}
            onChange={(e) => setFields({ ...fields, date: e.target.value })}
          />
        </label>
        <label className="full">
          Referencia del movimiento
          <input
            name="reference"
            value={fields.reference}
            onChange={(e) =>
              setFields({ ...fields, reference: e.target.value })
            }
            maxLength={200}
            placeholder="Transferencia, depósito o referencia bancaria"
          />
        </label>
      </div>
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="notice success" role="status">
          {state.success}
        </p>
      )}
      <div className="form-actions">
        <Button disabled={pending || !plans.length}>
          {pending ? "Registrando…" : "Registrar cobro"}
        </Button>
      </div>
    </form>
  );
}
export function ReversePaymentForm({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const [state, action, pending] = useActionState(reversePayment, {});
  return (
    <details className="reversal">
      <summary>Revertir movimiento</summary>
      <form action={action} className="form-stack">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <label>
          Motivo del reverso
          <input name="reason" minLength={3} maxLength={1000} required />
        </label>
        <Button variant="outline" disabled={pending}>
          {pending ? "Revirtiendo…" : "Confirmar reverso"}
        </Button>
        {state.error && (
          <p className="notice error" role="alert">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="notice success" role="status">
            {state.success}
          </p>
        )}
      </form>
    </details>
  );
}

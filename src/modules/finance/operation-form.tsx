"use client";
import { saveInvoice } from "./invoice-action";
import { saveBudgetItem } from "./budget-action";
import { useActionState } from "react";
import {
  reverseEntry,
  saveOperation,
  type OperationState,
} from "./operations-actions";
export function OperationForm({
  kind,
  id,
  children,
}: {
  kind: "work" | "case" | "entry" | "budget" | "invoice";
  id: string;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(
    kind === "invoice"
      ? saveInvoice
      : kind === "budget"
        ? saveBudgetItem
        : saveOperation.bind(null, kind),
    {} as OperationState,
  );
  return (
    <form action={action} className="panel padded">
      <input type="hidden" name="id" value={state.nextId ?? id} />
      <div className="form-grid">{children}</div>
      <button disabled={pending} className="button button-primary">
        {pending ? "Guardando…" : "Guardar"}
      </button>
      <p role="status">{state.error || state.success}</p>
    </form>
  );
}

export function ReverseEntryForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(
    reverseEntry,
    {} as OperationState,
  );
  return (
    <details>
      <summary>Revertir movimiento</summary>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <label>
          Motivo de la corrección
          <input name="reason" minLength={3} maxLength={500} required />
        </label>
        <button className="button button-outline" disabled={pending}>
          Confirmar reverso
        </button>
        <p role="status">{state.error || state.success}</p>
      </form>
    </details>
  );
}

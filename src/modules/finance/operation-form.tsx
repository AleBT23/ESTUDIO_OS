"use client";
import { RecordForm } from "@/shared/ui/record-form";
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
  kind: "work" | "case" | "entry" | "budget" | "invoice" | "supplier";
  id: string;
  children: React.ReactNode;
}) {
  const save =
    kind === "invoice"
      ? saveInvoice
      : kind === "budget"
        ? saveBudgetItem
        : saveOperation.bind(null, kind);
  return (
    <RecordForm id={id} save={save}>
      {children}
    </RecordForm>
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

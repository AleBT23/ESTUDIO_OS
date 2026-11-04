"use client";
import { useActionState } from "react";
import { saveOperation, type OperationState } from "./operations-actions";
export function OperationForm({
  kind,
  id,
  children,
}: {
  kind: "work" | "case" | "entry";
  id: string;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(
    saveOperation.bind(null, kind),
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

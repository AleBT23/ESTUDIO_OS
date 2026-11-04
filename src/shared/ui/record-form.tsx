"use client";
import { useActionState } from "react";
export type RecordState = { error?: string; success?: string; nextId?: string };
export function RecordForm({
  save,
  id,
  children,
}: {
  save: (prev: RecordState, data: FormData) => Promise<RecordState>;
  id: string;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(save, {} as RecordState);
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

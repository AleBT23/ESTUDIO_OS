"use client";
import { useActionState, useRef } from "react";
export type RecordState = { error?: string; success?: string; nextId?: string };
export function RecordForm({
  save,
  id,
  children,
  submitLabel = "Guardar",
}: {
  save: (prev: RecordState, data: FormData) => Promise<RecordState>;
  id: string;
  children: React.ReactNode;
  submitLabel?: string;
}) {
  const keepValues = useRef(false);
  const [state, action, pending] = useActionState(
    async (previous: RecordState, data: FormData) => {
      const result = await save(previous, data);
      keepValues.current = Boolean(result.error);
      return result;
    },
    {} as RecordState,
  );
  return (
    <form
      action={action}
      aria-busy={pending}
      onReset={(event) => {
        if (keepValues.current) {
          event.preventDefault();
          keepValues.current = false;
        }
      }}
      className="panel padded"
    >
      <input type="hidden" name="id" value={state.nextId ?? id} />
      <div className="form-grid">{children}</div>
      <button disabled={pending} className="button button-primary">
        {pending ? "Guardando…" : submitLabel}
      </button>
      <div role="alert" aria-atomic="true">
        {state.error && <p className="notice error">{state.error}</p>}
      </div>
      <div role="status" aria-atomic="true">
        {state.success && <p className="notice success">{state.success}</p>}
      </div>
    </form>
  );
}

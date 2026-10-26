"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { saveOpportunity } from "./pipeline-actions";
import { stages, type Opportunity } from "./pipeline-schema";
export function OpportunityForm({
  opportunity,
  clients,
  lines,
}: {
  opportunity?: Opportunity;
  clients: { id: string; name: string }[];
  lines: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveOpportunity, {});
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  return (
    <form
      action={action}
      onChange={() => setDirty(true)}
      className="panel padded"
    >
      <h2>{opportunity ? "Actualizar oportunidad" : "Nueva oportunidad"}</h2>
      {opportunity && (
        <>
          <input type="hidden" name="id" value={opportunity.id} />
          <input type="hidden" name="version" value={opportunity.version} />
        </>
      )}
      <div className="form-grid">
        <label className="full">
          Nombre de la oportunidad *
          <input
            name="name"
            required
            minLength={2}
            maxLength={160}
            defaultValue={opportunity?.name}
          />
        </label>
        <label>
          Cliente *
          <select
            name="client_id"
            required
            defaultValue={opportunity?.client_id || ""}
          >
            <option value="">Seleccionar cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Línea *
          <select
            name="business_line_id"
            required
            defaultValue={opportunity?.business_line_id || lines[0]?.id}
          >
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Etapa
          <select name="stage" defaultValue={opportunity?.stage || "new"}>
            {Object.entries(stages).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Próximo seguimiento
          <input
            type="date"
            name="next_follow_up"
            defaultValue={opportunity?.next_follow_up || ""}
          />
        </label>
        <label className="full">
          Notas y contexto
          <textarea
            name="notes"
            rows={5}
            maxLength={10000}
            defaultValue={opportunity?.notes || ""}
          />
        </label>
      </div>
      <p className="caption" style={{ marginTop: 20 }}>
        La fecha de seguimiento genera una señal en el pipeline mientras la
        oportunidad siga abierta. Al resolverla, cambia la fecha o deja el campo
        vacío.
      </p>
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <div className="form-actions">
        <Button variant="ghost" asChild>
          <Link href="/comercial/pipeline">Volver al pipeline</Link>
        </Button>
        <Button disabled={pending || !clients.length}>
          {pending ? "Guardando…" : "Guardar oportunidad"}
        </Button>
      </div>
    </form>
  );
}

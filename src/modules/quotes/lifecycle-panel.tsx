"use client";
import { useActionState, useState } from "react";
import { Button } from "@/shared/ui/button";
import { changeQuoteLifecycle } from "./lifecycle-actions";
type Intent = "reject" | "expire" | "revise";
export function QuoteLifecyclePanel({
  id,
  version,
  status,
  validUntil,
  today,
}: {
  id: string;
  version: number;
  status: string;
  validUntil: string;
  today: string;
}) {
  const available: { intent: Intent; label: string }[] = [];
  if (["draft", "sent"].includes(status))
    available.push({ intent: "reject", label: "Registrar rechazo" });
  if (["draft", "sent"].includes(status) && validUntil < today)
    available.push({ intent: "expire", label: "Registrar vencimiento" });
  if (["sent", "rejected", "expired"].includes(status))
    available.push({ intent: "revise", label: "Preparar una revisión" });
  const [intent, setIntent] = useState<Intent>(
    available[0]?.intent || "reject",
  );
  const [state, action, pending] = useActionState(changeQuoteLifecycle, {});
  if (!available.length) return null;
  const nextValidity = new Date(
    new Date(today + "T12:00:00Z").getTime() + 14 * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  return (
    <section className="panel padded" style={{ marginTop: 24 }}>
      <h2>Seguimiento de la propuesta</h2>
      <p className="muted">
        Registra la decisión del cliente o prepara una revisión. Cada cambio
        conserva el motivo y las versiones documentales anteriores.
      </p>
      <form action={action} className="form-stack">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="version" value={version} />
        <div className="form-grid">
          <label>
            Acción
            <select
              name="intent"
              value={intent}
              onChange={(e) => setIntent(e.target.value as Intent)}
            >
              {available.map((option) => (
                <option value={option.intent} key={option.intent}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {intent === "revise" && (
            <label>
              Nueva vigencia
              <input
                type="date"
                name="valid_until"
                min={today}
                required
                defaultValue={nextValidity}
              />
            </label>
          )}
          <label className="full">
            Motivo *
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={1000}
              rows={3}
            />
          </label>
        </div>
        {intent === "revise" && (
          <p className="notice">
            La propuesta volverá a borrador. Antes de compartirla de nuevo
            tendrás que emitir una nueva versión; los PDFs anteriores no se
            sobrescriben.
          </p>
        )}
        <Button disabled={pending} variant="outline">
          {pending ? "Actualizando…" : "Registrar cambio"}
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
    </section>
  );
}

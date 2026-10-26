"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { fromCents } from "@/shared/money";
import { saveService, archiveService } from "./actions";
import { units, type Service } from "./schema";
export function ServiceForm({
  service,
  lines,
}: {
  service?: Service;
  lines: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveService, {});
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  return (
    <form
      action={action}
      onChange={() => setDirty(true)}
      className="panel padded"
    >
      <h2>{service ? "Editar servicio" : "Nuevo servicio"}</h2>
      {service && (
        <>
          <input type="hidden" name="id" value={service.id} />
          <input type="hidden" name="version" value={service.version} />
        </>
      )}
      <div className="form-grid">
        <label className="full">
          Nombre *
          <input
            name="name"
            required
            minLength={2}
            maxLength={160}
            defaultValue={service?.name}
          />
        </label>
        <label>
          Clave *
          <input
            name="code"
            required
            maxLength={40}
            defaultValue={service?.code}
          />
        </label>
        <label>
          Línea *
          <select
            name="business_line_id"
            defaultValue={service?.business_line_id}
            required
          >
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoría
          <input
            name="category"
            maxLength={100}
            defaultValue={service?.category || ""}
          />
        </label>
        <label>
          Unidad
          <select name="unit" defaultValue={service?.unit || "fixed"}>
            {Object.entries(units).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Precio MXN / porcentaje de obra *
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={service ? fromCents(service.price_cents) : "0.00"}
          />
        </label>
        <label>
          Costo estimado MXN
          <input
            name="estimatedCost"
            type="number"
            min="0"
            step="0.01"
            required
            defaultValue={
              service ? fromCents(service.estimated_cost_cents) : "0.00"
            }
          />
        </label>
        <label>
          Vigente hasta
          <input
            name="valid_until"
            type="date"
            defaultValue={service?.valid_until || ""}
          />
        </label>
        <label className="full">
          Descripción y alcance
          <textarea
            name="description"
            maxLength={10000}
            rows={4}
            defaultValue={service?.description || ""}
          />
        </label>
      </div>
      <p className="caption" style={{ marginTop: 18 }}>
        Para porcentaje: captura 8 para el 8% del costo de obra. Editar una
        cotización conservará este precio de catálogo.
      </p>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
      <div className="form-actions">
        <Button asChild variant="ghost">
          <Link href="/comercial/catalogo">Cancelar</Link>
        </Button>
        <Button disabled={pending}>
          {pending ? "Guardando…" : "Guardar servicio"}
        </Button>
      </div>
    </form>
  );
}
export function ArchiveServiceForm({ service }: { service: Service }) {
  const [state, action, pending] = useActionState(archiveService, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={service.id} />
      <input type="hidden" name="version" value={service.version} />
      <input
        type="hidden"
        name="intent"
        value={service.deleted_at ? "restore" : "archive"}
      />
      <Button disabled={pending} variant="outline">
        {pending
          ? "Guardando…"
          : service.deleted_at
            ? "Restaurar servicio"
            : "Archivar servicio"}
      </Button>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="notice success">
          {state.success}
        </p>
      )}
    </form>
  );
}

"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { savePreset } from "./actions";
import type { Service } from "./schema";
export function PresetForm({
  services,
  preset,
}: {
  services: Service[];
  preset?: {
    id: string;
    name: string;
    notes: string;
    version: number;
    items: { service_id: string; quantity: string }[];
  };
}) {
  const [state, action, pending] = useActionState(savePreset, {});
  const [selected, setSelected] = useState(preset?.items || []);
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  return (
    <form
      action={action}
      className="panel padded"
      onChange={() => setDirty(true)}
    >
      <input type="hidden" name="id" value={preset?.id || ""} />
      <input type="hidden" name="version" value={preset?.version || 0} />
      <input type="hidden" name="items" value={JSON.stringify(selected)} />
      <h2>{preset ? "Editar preset" : "Nuevo preset"}</h2>
      <div className="form-grid">
        <label className="full">
          Nombre *
          <input
            name="name"
            defaultValue={preset?.name}
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label className="full">
          Notas de alcance
          <textarea
            name="notes"
            defaultValue={preset?.notes || ""}
            maxLength={10000}
          />
        </label>
      </div>
      <p className="caption" style={{ marginTop: 20 }}>
        Selecciona servicios y cantidades iniciales. Cada cotización conservará
        una copia editable.
      </p>
      <div className="preset-list">
        {services.map((service) => {
          const item = selected.find((s) => s.service_id === service.id);
          return (
            <div className="preset-choice" key={service.id}>
              <label>
                <input
                  type="checkbox"
                  checked={!!item}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [
                            ...selected,
                            { service_id: service.id, quantity: "1" },
                          ]
                        : selected.filter((i) => i.service_id !== service.id),
                    )
                  }
                />
                <span>{service.name}</span>
              </label>
              {item && (
                <label>
                  Cantidad
                  <input
                    aria-label={`Cantidad de ${service.name}`}
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={item.quantity}
                    onChange={(e) =>
                      setSelected(
                        selected.map((i) =>
                          i.service_id === service.id
                            ? { ...i, quantity: e.target.value }
                            : i,
                        ),
                      )
                    }
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
      {!services.length && (
        <p className="notice">
          Crea servicios en el catálogo antes de guardar un preset.
        </p>
      )}
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <div className="form-actions">
        <Button asChild variant="ghost">
          <Link href="/comercial/presets">Cancelar</Link>
        </Button>
        <Button disabled={pending || !services.length}>
          {pending ? "Guardando…" : "Guardar preset"}
        </Button>
      </div>
    </form>
  );
}

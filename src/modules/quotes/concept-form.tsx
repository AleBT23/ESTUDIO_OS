"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { saveConcept, archiveConcept } from "./concept-actions";
import type { Concept } from "./concept-schema";
export function ConceptForm({ concept }: { concept?: Concept }) {
  const [state, action, pending] = useActionState(saveConcept, {});
  const [dirty, setDirty] = useState(false);
  const [loadedVersion] = useState(concept?.version);
  useUnsavedChanges(dirty);
  return (
    <form
      action={action}
      className="panel padded"
      onChange={() => setDirty(true)}
    >
      <h2>{concept ? "Editar concepto" : "Nuevo concepto"}</h2>
      {concept && (
        <>
          <input type="hidden" name="id" value={concept.id} />
          <input type="hidden" name="version" value={loadedVersion} />
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
            defaultValue={concept?.name}
            placeholder="Un nombre fácil de encontrar"
          />
        </label>
        <label className="full">
          Descripción reutilizable *
          <textarea
            name="body"
            rows={10}
            required
            maxLength={10000}
            defaultValue={concept?.body}
            placeholder="Alcance, inclusiones o notas para tus propuestas."
          />
        </label>
      </div>
      <p className="caption" style={{ marginTop: 18 }}>
        Al insertarlo en una partida se copia el texto. Editar esa copia o este
        concepto no modifica las otras propuestas.
      </p>
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <div className="form-actions">
        <span className="caption">{dirty ? "Cambios sin guardar" : ""}</span>
        <Button variant="ghost" asChild>
          <Link href="/comercial/conceptos">Cancelar</Link>
        </Button>
        <Button disabled={pending}>
          {pending ? "Guardando…" : "Guardar concepto"}
        </Button>
      </div>
    </form>
  );
}
export function ArchiveConceptForm({ concept }: { concept: Concept }) {
  const [state, action, pending] = useActionState(archiveConcept, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={concept.id} />
      <input type="hidden" name="version" value={concept.version} />
      <input
        type="hidden"
        name="intent"
        value={concept.deleted_at ? "restore" : "archive"}
      />
      <Button variant="outline" disabled={pending}>
        {pending
          ? "Actualizando…"
          : concept.deleted_at
            ? "Restaurar concepto"
            : "Archivar concepto"}
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
  );
}

"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { saveClient, archiveClient } from "./actions";
import type { Client } from "./schema";
export function ClientForm({
  client,
  lines,
}: {
  client?: Client;
  lines: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveClient, {});
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const handle = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const handle = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest("a");
      if (
        link &&
        !link.hasAttribute("download") &&
        !window.confirm(
          "Tienes cambios sin guardar. ¿Quieres salir de esta página?",
        )
      )
        event.preventDefault();
    };
    document.addEventListener("click", handle, true);
    return () => document.removeEventListener("click", handle, true);
  }, [dirty]);
  return (
    <form
      action={action}
      onChange={() => setDirty(true)}
      className="panel padded"
    >
      {client && (
        <>
          <input type="hidden" name="id" value={client.id} />
          <input type="hidden" name="version" value={client.version} />
        </>
      )}
      <div className="form-grid">
        <label className="full">
          Nombre o razón social *
          <input
            name="name"
            defaultValue={client?.name}
            required
            minLength={2}
            maxLength={160}
            autoComplete="name"
            placeholder="¿Con quién vamos a trabajar?"
          />
        </label>
        <label>
          Tipo de cliente
          <select name="kind" defaultValue={client?.kind || "person"}>
            <option value="person">Persona</option>
            <option value="company">Empresa</option>
          </select>
        </label>
        <label>
          Línea de interés
          <select
            name="business_line_id"
            defaultValue={client?.business_line_id || ""}
          >
            <option value="">Ambas / por definir</option>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Correo electrónico
          <input
            type="email"
            name="email"
            defaultValue={client?.email}
            maxLength={254}
            autoComplete="email"
          />
        </label>
        <label>
          Teléfono
          <input
            type="tel"
            name="phone"
            defaultValue={client?.phone}
            maxLength={40}
            autoComplete="tel"
          />
        </label>
        <label className="full">
          Dirección
          <input
            name="address"
            defaultValue={client?.address}
            maxLength={500}
            autoComplete="street-address"
          />
        </label>
        <label className="full">
          ¿Cómo llegó al estudio?
          <input
            name="source"
            defaultValue={client?.source}
            maxLength={120}
            placeholder="Recomendación, portafolio, Instagram…"
          />
        </label>
        <label className="full">
          Notas de la relación
          <textarea
            name="notes"
            defaultValue={client?.notes}
            maxLength={10000}
            rows={5}
            placeholder="Contexto, preferencias y detalles que vale la pena recordar."
          />
        </label>
      </div>
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <div className="form-actions">
        <span className="caption">
          {dirty
            ? "Tienes cambios sin guardar"
            : "Solo el nombre es obligatorio."}
        </span>
        <Button variant="ghost" asChild>
          <Link
            href={client ? `/comercial/clientes/${client.id}` : "/comercial"}
          >
            Cancelar
          </Link>
        </Button>
        <Button disabled={pending}>
          {pending
            ? "Guardando…"
            : client
              ? "Guardar cambios"
              : "Crear cliente"}
        </Button>
      </div>
    </form>
  );
}
export function ArchiveClientForm({ client }: { client: Client }) {
  const [state, action, pending] = useActionState(archiveClient, {});
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !client.deleted_at &&
          !window.confirm(
            "¿Archivar este cliente? Se conservarán sus datos y podrás restaurarlo.",
          )
        )
          event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={client.id} />
      <input type="hidden" name="version" value={client.version} />
      <input
        type="hidden"
        name="intent"
        value={client.deleted_at ? "restore" : "archive"}
      />
      <Button variant="outline" disabled={pending}>
        {pending
          ? "Actualizando…"
          : client.deleted_at
            ? "Restaurar cliente"
            : "Archivar cliente"}
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

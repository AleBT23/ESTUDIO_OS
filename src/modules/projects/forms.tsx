"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  createProject,
  defineProjectAmount,
  saveProjectNote,
  toggleProjectNote,
} from "./actions";
import type { ProjectNote } from "./schema";
export function NoteForm({
  project,
  note,
}: {
  project: string;
  note?: ProjectNote;
}) {
  const [body, setBody] = useState(note?.body || "");
  const [due, setDue] = useState(note?.due_on || "");
  const [kind, setKind] = useState(note?.kind || "task");
  const [state, action, pending] = useActionState(
    async (prev: { error?: string; success?: string }, form: FormData) => {
      const result = await saveProjectNote(prev, form);
      if (result.success && !note) setBody("");
      return result;
    },
    {} as { error?: string; success?: string },
  );
  return (
    <form
      action={action}
      className="form-stack"
      data-dirty={body !== (note?.body || "") || due !== (note?.due_on || "")}
    >
      <input type="hidden" name="project" value={project} />
      {note && (
        <>
          <input type="hidden" name="id" value={note.id} />
          <input type="hidden" name="version" value={note.version} />
        </>
      )}
      <label>
        {note ? "Texto" : "¿Qué necesitas recordar?"}
        <textarea
          name="body"
          required
          maxLength={10000}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Corregir plano, revisar una medida, actualizar una entrega…"
        />
      </label>
      <div className="form-grid">
        <label>
          Tipo
          <select
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "task" | "note")}
            disabled={!!note}
          >
            <option value="task">Pendiente para completar</option>
            <option value="note">Nota de seguimiento</option>
          </select>
        </label>
        {note && <input type="hidden" name="kind" value={note.kind} />}
        <label>
          Fecha de seguimiento (opcional)
          <input
            type="date"
            name="due_on"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
      </div>
      <Status {...state} />
      <Button disabled={pending}>
        {pending
          ? "Guardando…"
          : note
            ? "Guardar cambios"
            : "Guardar nota o pendiente"}
      </Button>
    </form>
  );
}
export function NoteRow({
  note,
  writable = false,
  showProject = false,
}: {
  note: ProjectNote;
  writable?: boolean;
  showProject?: boolean;
}) {
  const [state, action, pending] = useActionState(toggleProjectNote, {});
  return (
    <div className={`project-note ${note.completed_at ? "is-done" : ""}`}>
      {note.kind === "task" &&
        (writable ? (
          <form action={action}>
            <input type="hidden" name="id" value={note.id} />
            <input type="hidden" name="project" value={note.project_id} />
            <input type="hidden" name="version" value={note.version} />
            <input
              type="hidden"
              name="done"
              value={note.completed_at ? "no" : "yes"}
            />
            <button
              className="task-toggle"
              disabled={pending}
              aria-label={`${note.completed_at ? "Reabrir" : "Completar"}: ${note.body.slice(0, 100)}`}
              aria-pressed={!!note.completed_at}
            >
              {note.completed_at ? "✓" : "○"}
            </button>
          </form>
        ) : (
          <span aria-label={note.completed_at ? "Completado" : "Pendiente"}>
            {note.completed_at ? "✓" : "○"}
          </span>
        ))}
      <div>
        {showProject && (
          <Link className="text-link" href={`/proyectos/${note.project_id}`}>
            {note.project_name}
          </Link>
        )}
        <p className="note-body">{note.body}</p>
        <p className="caption">
          {note.kind === "note" ? "Nota" : "Pendiente"}
          {note.due_on ? ` · Seguimiento ${note.due_on}` : ""} ·{" "}
          {note.completed_at ? "Completado" : "Registrado"}{" "}
          {new Intl.DateTimeFormat("es-MX", {
            dateStyle: "medium",
            timeZone: "America/Mexico_City",
          }).format(new Date(note.completed_at || note.created_at))}
        </p>
        <Status {...state} />
        {writable && (
          <details>
            <summary>Editar nota</summary>
            <NoteForm project={note.project_id} note={note} />
          </details>
        )}
      </div>
    </div>
  );
}
export function Status({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return (
    <>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="notice success" role="status">
          {success}
        </p>
      )}
    </>
  );
}
export function NewProjectForm({
  clients,
  today,
  requestId,
}: {
  clients: { id: string; name: string }[];
  today: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(createProject, {});
  return (
    <form action={action} className="panel padded form-stack">
      <input type="hidden" name="request_id" value={requestId} />
      <label>
        Nombre del proyecto u obra
        <input name="name" required minLength={2} maxLength={160} />
      </label>
      <label>
        Cliente
        <select name="client" required defaultValue="">
          <option value="">Seleccionar cliente…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Link className="text-link" href="/comercial/clientes/nuevo">
        Crear un cliente primero →
      </Link>
      <div className="form-grid">
        <label>
          Fecha de inicio
          <input name="start_on" type="date" required defaultValue={today} />
        </label>
        <label>
          Importe acordado total MXN (opcional)
          <input
            name="total"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            max="999999999999"
            placeholder="Puedes definirlo después"
          />
        </label>
      </div>
      <p className="caption">
        Es el precio acordado con el cliente, no un costo interno. Los anticipos
        recibidos se registran después, con su fecha real.
      </p>
      <Status {...state} />
      <Button disabled={pending || !clients.length}>
        {pending ? "Creando…" : "Crear proyecto"}
      </Button>
    </form>
  );
}
export function AmountForm({
  project,
  version,
  today,
}: {
  project: string;
  version: number;
  today: string;
}) {
  const [state, action, pending] = useActionState(defineProjectAmount, {});
  return (
    <form action={action} className="form-stack">
      <h3>Registrar el importe acordado</h3>
      <input type="hidden" name="project" value={project} />
      <input type="hidden" name="version" value={version} />
      <label>
        Total acordado MXN
        <input
          name="total"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
        />
      </label>
      <label>
        Fecha prevista del cobro
        <input name="due_on" type="date" defaultValue={today} required />
      </label>
      <Status {...state} />
      <Button disabled={pending}>
        {pending ? "Guardando…" : "Guardar importe"}
      </Button>
    </form>
  );
}

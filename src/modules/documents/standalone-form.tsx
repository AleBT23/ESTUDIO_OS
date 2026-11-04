"use client";
import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import { splitLetterhead } from "./image-references";
import { defaultDocumentOptions } from "./schema";
import { documentKinds, type StudioDocument } from "./standalone-schema";
import { saveStudioDocument, issueStudioDocument } from "./standalone-actions";
export function StudioDocumentForm({
  document,
  template,
  clients,
  projects,
  images = [],
  imageError = false,
}: {
  document?: StudioDocument;
  template?: Pick<StudioDocument, "kind" | "margins" | "title" | "body">;
  clients: { id: string; name: string }[];
  images?: { id: string; title: string; filename: string; version: number }[];
  imageError?: boolean;
  projects: { id: string; name: string; client_id: string }[];
}) {
  const [state, action, pending] = useActionState(saveStudioDocument, {});
  const [version] = useState(document?.version || 0);
  const [dirty, setDirty] = useState(false);
  const source = splitLetterhead(document?.body || template?.body || "");
  const [letterhead, setLetterhead] = useState(source.id);
  const [fields, setFields] = useState({
    title: document?.title || template?.title || "",
    kind: document?.kind || template?.kind || "letter",
    body: source.content,
    client_id: document?.client_id || "",
    project_id: document?.project_id || "",
    margins:
      document?.margins ||
      template?.margins ||
      structuredClone(defaultDocumentOptions.margins),
  });
  const textArea = useRef<HTMLTextAreaElement>(null);
  useUnsavedChanges(dirty);
  function update<K extends keyof typeof fields>(
    key: K,
    value: (typeof fields)[K],
  ) {
    setFields({ ...fields, [key]: value });
    setDirty(true);
  }
  function insert(text: string) {
    const start = textArea.current?.selectionStart ?? fields.body.length;
    const end = textArea.current?.selectionEnd ?? start;
    update("body", fields.body.slice(0, start) + text + fields.body.slice(end));
    requestAnimationFrame(() => {
      textArea.current?.focus();
      textArea.current?.setSelectionRange(
        start + text.length,
        start + text.length,
      );
    });
  }
  return (
    <form action={action} className="panel padded">
      <input type="hidden" name="id" value={document?.id || ""} />
      <input type="hidden" name="version" value={version} />
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify({
          ...fields,
          body: letterhead
            ? "[[membrete:" + letterhead + "]]\n" + fields.body
            : fields.body,
        })}
      />
      <h2>{document ? "Editar documento" : "Nuevo documento"}</h2>
      <div className="form-grid">
        <label className="full">
          Título *
          <input
            value={fields.title}
            onChange={(e) => update("title", e.target.value)}
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label>
          Tipo de documento
          <select
            value={fields.kind}
            onChange={(e) =>
              update("kind", e.target.value as StudioDocument["kind"])
            }
          >
            {Object.entries(documentKinds).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente (opcional)
          <select
            value={fields.client_id}
            onChange={(e) => update("client_id", e.target.value)}
          >
            <option value="">Sin cliente asociado</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="full">
          Proyecto (opcional)
          <select
            value={fields.project_id}
            onChange={(e) => {
              const project = projects.find((p) => p.id === e.target.value);
              setFields({
                ...fields,
                project_id: e.target.value,
                client_id: project?.client_id || fields.client_id,
              });
              setDirty(true);
            }}
          >
            <option value="">Sin proyecto asociado</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="full">
          <p className="caption">Insertar en el texto</p>
          <div className="document-tools">
            {[
              ["Fecha", "{{fecha}}"],
              ["Estudio", "{{despacho.nombre}}"],
              ["Cliente", "{{cliente.nombre}}"],
              ["Proyecto", "{{proyecto.nombre}}"],
              ["Subtítulo", "\n## Título de sección\n"],
              [
                "Tabla",
                "\n| Concepto | Detalle |\n| --- | --- |\n| Elemento | Descripción |\n",
              ],
              ["Lista", "\n- Elemento\n"],
              ["Salto de página", "\n[[salto]]\n"],
            ].map(([label, value]) => (
              <Button
                key={label}
                type="button"
                variant="outline"
                onClick={() => insert(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <label className="full">
          Membrete de todas las páginas
          <select
            value={letterhead}
            onChange={(e) => {
              setLetterhead(e.target.value);
              setDirty(true);
            }}
          >
            <option value="">Oficial del despacho</option>
            {letterhead && !images.some((i) => i.id === letterhead) && (
              <option value={letterhead}>
                Revisión del documento · {letterhead.slice(0, 8)}
              </option>
            )}
            {images.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title} · v{i.version} · {i.filename}
              </option>
            ))}
          </select>
          <small>
            Se ajusta a tamaño carta conservando su proporción. Comprueba los
            márgenes en la vista previa.
          </small>
        </label>
        <label className="full">
          Insertar imagen de biblioteca
          <select
            value=""
            onChange={(e) => {
              if (e.target.value)
                insert("\n[[imagen:" + e.target.value + "]]\n");
            }}
          >
            <option value="">Seleccionar una versión PNG o JPEG</option>
            {images.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title} · v{i.version} · {i.filename}
              </option>
            ))}
          </select>
        </label>
        <p>
          {imageError ? "No se pudo consultar la biblioteca. " : ""}También
          puedes copiar la referencia de una versión anterior desde la
          biblioteca.
        </p>
        <label className="full">
          Contenido *
          <textarea
            ref={textArea}
            value={fields.body}
            onChange={(e) => update("body", e.target.value)}
            required
            maxLength={40000}
            rows={15}
            placeholder="Escribe el contenido de la carta, oficio, minuta o reporte."
          />
        </label>
      </div>
      <p className="caption">
        Las variables se completan con los datos asociados al documento. Si
        falta un dato, la emisión se detendrá para que lo revises. Para insertar
        una tabla de dos a seis columnas, conserva la línea de guiones bajo los
        encabezados y separa cada celda con una barra vertical.
      </p>
      <details>
        <summary className="text-link">Ajustar márgenes del membrete</summary>
        <div className="form-grid">
          {(
            [
              ["top", "Superior", 32, 60],
              ["bottom", "Inferior", 26, 60],
              ["left", "Izquierdo", 12, 45],
              ["right", "Derecho", 24, 50],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              {label} · mm
              <input
                type="number"
                required
                min={min}
                max={max}
                step="0.5"
                value={fields.margins[key]}
                onChange={(e) =>
                  update("margins", {
                    ...fields.margins,
                    [key]: Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
        </div>
      </details>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
      <div className="form-actions">
        <span className="caption">
          {dirty
            ? "Cambios sin guardar"
            : "Guarda antes de previsualizar o emitir."}
        </span>
        <Button asChild variant="ghost">
          <Link href="/recursos/documentos">Cancelar</Link>
        </Button>
        <Button disabled={pending}>
          {pending ? "Guardando…" : "Guardar documento"}
        </Button>
      </div>
    </form>
  );
}
export function IssueStudioDocumentForm({
  id,
  version,
  alreadyIssued,
}: {
  id: string;
  version: number;
  alreadyIssued: boolean;
}) {
  const [state, action, pending] = useActionState(issueStudioDocument, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <Button disabled={pending || alreadyIssued}>
        {pending
          ? "Generando y guardando…"
          : alreadyIssued
            ? "Edición emitida"
            : "Emitir PDF inmutable"}
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

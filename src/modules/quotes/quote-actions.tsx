"use client";
import Link from "next/link";
import { useActionState, useRef } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { archiveQuote } from "./archive-action";

export function QuoteActions({
  id,
  version,
  name,
  folio,
  accepted = false,
}: {
  id: string;
  version: number;
  name: string;
  folio?: string;
  accepted?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [state, action, pending] = useActionState(archiveQuote, {});
  const close = () => {
    if (!pending) dialog.current?.close();
  };
  return (
    <>
      <details ref={menu} className="quote-actions-menu">
        <summary aria-label={`Acciones de ${name}`}>
          <MoreHorizontal size={18} aria-hidden="true" />
        </summary>
        <div className="quote-actions-popover">
          <Link href={`/comercial/cotizaciones/${id}`}>Ver cotización</Link>
          <button
            type="button"
            className="danger-text"
            onClick={(event) => {
              trigger.current =
                event.currentTarget
                  .closest("details")
                  ?.querySelector("summary") || null;
              if (menu.current) menu.current.open = false;
              dialog.current?.showModal();
            }}
          >
            Eliminar cotización
          </button>
        </div>
      </details>
      <dialog
        ref={dialog}
        className="quote-delete-dialog panel"
        aria-labelledby={`delete-title-${id}`}
        aria-describedby={`delete-description-${id}`}
        onClose={() => trigger.current?.focus()}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <h2 id={`delete-title-${id}`}>
          {accepted
            ? "Esta propuesta respalda un proyecto"
            : "¿Eliminar cotización?"}
        </h2>
        <p className="quote-delete-name">
          {folio ? `${folio} · ` : ""}
          {name}
        </p>
        <p id={`delete-description-${id}`}>
          {accepted
            ? "La cotización aceptada conserva el acuerdo y las obligaciones del proyecto. Puedes consultar y gestionar su expediente desde Proyectos."
            : "Se retirará de los listados activos. Conservaremos su historial, partidas y PDFs; el cliente y el catálogo no se modificarán."}
        </p>
        {state.error && (
          <p className="notice error" role="alert">
            {state.error} <Link href="/proyectos">Consultar proyectos →</Link>
          </p>
        )}
        {accepted ? (
          <div className="form-actions">
            <Button variant="outline" onClick={close}>
              Cerrar
            </Button>
            <Button asChild>
              <Link href="/proyectos">Ir a Proyectos</Link>
            </Button>
          </div>
        ) : (
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="confirmed" value="yes" />
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                autoFocus
                disabled={pending}
                onClick={close}
              >
                Conservar cotización
              </Button>
              <Button
                type="submit"
                className="quote-delete-button"
                disabled={pending}
              >
                {pending ? "Eliminando…" : "Eliminar cotización"}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

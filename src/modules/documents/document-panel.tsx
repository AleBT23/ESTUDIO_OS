"use client";
import { useActionState, useState } from "react";
import { FileDown } from "lucide-react";
import { LayoutEditor } from "./layout-editor";
import { Button } from "@/shared/ui/button";
import { issueQuote, markSent, acceptQuote } from "./actions";
import { defaultDocumentOptions, type DocumentOptions } from "./schema";
type Version = {
  id: string;
  folio: string;
  state: string;
  draft_version: number;
  version_number: number;
  issued_at: string | null;
};
export function DocumentPanel({
  id,
  version,
  status,
  versions,
  today,
  initialLayout,
  images = [],
  imageError = false,
}: {
  initialLayout?: DocumentOptions | null;
  images?: { id: string; title: string; filename: string; version: number }[];
  imageError?: boolean;
  id: string;
  version: number;
  status: string;
  versions: Version[];
  today: string;
}) {
  const [options, setOptions] = useState<DocumentOptions>(
    structuredClone(initialLayout ?? defaultDocumentOptions),
  );
  const [showPreview, setShowPreview] = useState(false);
  const [issueState, issueAction, issuing] = useActionState(issueQuote, {});
  const [sentState, sentAction, sending] = useActionState(markSent, {});
  const [acceptState, acceptAction, accepting] = useActionState(
    acceptQuote,
    {},
  );
  const latest = versions.find(
    (v) => v.state === "issued" && v.draft_version === version,
  );
  const previewURL = `/api/cotizaciones/${id}/preview?${new URLSearchParams({ options: JSON.stringify(options) })}`;
  return (
    <section className="panel padded" style={{ marginTop: 24 }}>
      <p className="eyebrow">DOCUMENTO DEL ESTUDIO</p>
      <h2>Una propuesta con tu firma</h2>
      {status === "draft" && (
        <>
          <p className="muted">
            Previsualiza el borrador guardado. Al emitir se conservan contenido,
            importes, márgenes y PDF; los cambios posteriores no alteran esa
            versión.
          </p>
          <form action={issueAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="version" value={version} />
            <input
              type="hidden"
              name="options"
              value={JSON.stringify(options)}
            />
            <LayoutEditor
              options={options}
              setOptions={(v) => {
                setOptions(v);
                setShowPreview(false);
              }}
              images={images}
              imageError={imageError}
            />
            <div className="form-actions">
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? "Cerrar vista previa" : "Vista previa PDF"}
              </Button>
              <Button disabled={issuing || !!latest}>
                {issuing
                  ? "Generando y guardando…"
                  : latest
                    ? "Edición emitida"
                    : "Emitir versión inmutable"}
              </Button>
            </div>
            {issueState.error && (
              <p className="notice error" role="alert">
                {issueState.error}
              </p>
            )}
            {issueState.success && (
              <p className="notice success" role="status">
                {issueState.success}
              </p>
            )}
          </form>
          {showPreview && (
            <>
              <iframe
                className="pdf-preview"
                src={previewURL}
                title="Vista previa PDF con membrete oficial"
              />
              <a
                className="text-link"
                href={previewURL}
                target="_blank"
                rel="noreferrer"
              >
                Abrir vista previa en otra pestaña ↗
              </a>
            </>
          )}
        </>
      )}
      <h3 style={{ marginTop: 28 }}>Versiones emitidas</h3>
      {versions
        .filter((v) => v.state === "issued")
        .map((v) => (
          <div className="version-row" key={v.id}>
            <span>
              {v.folio}
              <small>
                Versión documental {v.version_number} · Edición{" "}
                {v.draft_version}
              </small>
            </span>
            <a
              className="button button-outline"
              href={`/api/documentos/${v.id}`}
            >
              <FileDown size={15} />
              Descargar PDF
            </a>
          </div>
        ))}
      {!versions.some((v) => v.state === "issued") && (
        <p className="muted">Todavía no se ha emitido ninguna versión.</p>
      )}
      {status === "draft" && latest && (
        <form action={sentAction} className="form-stack">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="issued_version" value={latest.id} />
          <p className="caption">
            Después de compartir el PDF con tu cliente, registra el envío. Esta
            acción no envía correo ni mensajes.
          </p>
          <Button disabled={sending} variant="outline">
            {sending ? "Registrando…" : "Ya compartí el PDF · Registrar envío"}
          </Button>
          {sentState.error && (
            <p className="notice error" role="alert">
              {sentState.error}
            </p>
          )}
          {sentState.success && (
            <p className="notice success" role="status">
              {sentState.success}
            </p>
          )}
        </form>
      )}
      {status === "sent" && (
        <form action={acceptAction} className="form-stack">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="version" value={version} />
          <h3>Aceptación y plan de cobro</h3>
          <p className="muted">
            Confirma que el cliente aceptó la versión enviada. Si es una
            cotización complementaria, los paquetes y el plan de cobro se
            incorporan al proyecto vinculado. Para una propuesta inicial se crea
            un proyecto.
          </p>
          <div className="form-grid">
            <label>
              Fecha prevista del anticipo
              <input
                type="date"
                name="advance_due"
                required
                defaultValue={today}
              />
            </label>
            <label>
              Fecha prevista del saldo
              <input
                type="date"
                name="balance_due"
                required
                defaultValue={today}
              />
            </label>
          </div>
          <Button disabled={accepting}>
            {accepting
              ? "Registrando aceptación…"
              : "Registrar aceptación y plan de cobro"}
          </Button>
          {acceptState.error && (
            <p className="notice error" role="alert">
              {acceptState.error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

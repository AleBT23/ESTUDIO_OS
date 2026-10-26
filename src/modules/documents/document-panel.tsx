"use client";
import { useActionState, useState } from "react";
import { ArrowUp, ArrowDown, FileDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { issueQuote, markSent, acceptQuote } from "./actions";
import {
  defaultDocumentOptions,
  sectionLabels,
  type DocumentOptions,
} from "./schema";
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
}: {
  id: string;
  version: number;
  status: string;
  versions: Version[];
  today: string;
}) {
  const [options, setOptions] = useState<DocumentOptions>(
    structuredClone(defaultDocumentOptions),
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
  function move(index: number, delta: number) {
    const list = [...options.sections];
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    setOptions({ ...options, sections: list });
    setShowPreview(false);
  }
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
            <div className="settings-grid">
              <div>
                <h3>Secciones y orden</h3>
                {Object.entries(sectionLabels)
                  .filter(
                    ([key]) =>
                      !options.sections.includes(
                        key as DocumentOptions["sections"][number],
                      ),
                  )
                  .map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setOptions({
                          ...options,
                          sections: [
                            ...options.sections,
                            key as DocumentOptions["sections"][number],
                          ],
                        });
                        setShowPreview(false);
                      }}
                    >
                      + {label}
                    </Button>
                  ))}
                <ol className="document-sections">
                  {options.sections.map((section, index) => (
                    <li key={section}>
                      <span>{sectionLabels[section]}</span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Subir ${sectionLabels[section]}`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Bajar ${sectionLabels[section]}`}
                        disabled={index === options.sections.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      {section !== "budget" && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            setOptions({
                              ...options,
                              sections: options.sections.filter(
                                (s) => s !== section,
                              ),
                            });
                            setShowPreview(false);
                          }}
                          aria-label={`Quitar ${sectionLabels[section]}`}
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h3>Márgenes del membrete · mm</h3>
                <div className="form-grid">
                  {(
                    [
                      ["top", "Superior", 22, 60],
                      ["bottom", "Inferior", 26, 60],
                      ["left", "Izquierdo", 12, 45],
                      ["right", "Derecho", 24, 50],
                    ] as const
                  ).map(([key, label, min, max]) => (
                    <label key={key}>
                      {label}
                      <input
                        type="number"
                        min={min}
                        max={max}
                        required
                        step="0.5"
                        value={options.margins[key]}
                        onChange={(e) => {
                          setOptions({
                            ...options,
                            margins: {
                              ...options.margins,
                              [key]: Number(e.target.value),
                            },
                          });
                          setShowPreview(false);
                        }}
                      />
                    </label>
                  ))}
                </div>
                <p className="caption" style={{ marginTop: 14 }}>
                  Carta 215.9 × 279.4 mm. Los mínimos reservan logotipo,
                  ornamento lateral y datos inferiores del PNG oficial.
                </p>
              </div>
            </div>
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
            Confirma que el cliente aceptó la versión enviada. Se creará un
            proyecto con paquetes por línea y obligaciones de pago; el cobrado
            permanecerá en cero.
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
              ? "Creando proyecto…"
              : "Registrar aceptación y crear proyecto"}
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

"use client";
import { useState } from "react";
import { reviewLegacyBackup } from "@/shared/db/legacy-review";

type Review = Awaited<ReturnType<typeof reviewLegacyBackup>>;
export function LegacyReviewPanel() {
  const [result, setResult] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function review(file?: File) {
    setError("");
    setResult(null);
    if (!file) return;
    if (file.size > 32 * 1024 * 1024) {
      setError("La revisión local admite archivos de hasta 32 MiB.");
      return;
    }
    setBusy(true);
    try {
      setResult(await reviewLegacyBackup(JSON.parse(await file.text())));
    } catch {
      setError(
        "No se pudo verificar el formato, la huella SHA-256 o los conteos. Conserva el original y revisa la exportación.",
      );
    } finally {
      setBusy(false);
    }
  }
  const labels = {
    clients: "Clientes",
    services: "Servicios",
    concept_library: "Conceptos",
    presets: "Presets",
    proposals: "Cotizaciones",
  };
  return (
    <section className="panel padded">
      <h2>Revisar exportación del tabulador</h2>
      <p>
        Selecciona el JSON generado por el exportador. La revisión se realiza en
        este navegador.
      </p>
      <label>
        Archivo de exportación
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(e) => void review(e.target.files?.[0])}
        />
      </label>
      <p role="status">{busy ? "Verificando huella y referencias…" : error}</p>
      {result && (
        <>
          <h3>Informe de conciliación</h3>
          <p>
            Exportación del {result.exportedAt}. Huella y conteos verificados.
          </p>
          <dl>
            {Object.entries(result.counts).map(([k, n]) => (
              <div key={k}>
                <dt>{labels[k as keyof typeof labels]}</dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>
          <p>
            Propuestas conciliadas: {result.matched}. Con diferencias:{" "}
            {result.different}. Sin cálculo verificable: {result.unreadable}.
          </p>
          <p>
            La comparación usa las partidas y el IVA guardado en cada propuesta.
          </p>
          {!!result.services.length && (
            <details>
              <summary>Identificadores de servicios para staging</summary>
              <ul>
                {result.services.map((s, i) => (
                  <li key={i}>
                    {s.name} · <code>{s.id}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <h3>Incidencias ({result.issueCount})</h3>
          {result.issueCount ? (
            <>
              <ol>
                {result.issues.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {result.issueCount > 100 && <p>Se muestran las primeras 100.</p>}
            </>
          ) : (
            <p>Sin incidencias en las comprobaciones realizadas.</p>
          )}
        </>
      )}
    </section>
  );
}

"use client";
import { useState } from "react";
import { reviewLegacyBackup } from "@/shared/db/legacy-review";

type Review = Awaited<ReturnType<typeof reviewLegacyBackup>>;
export function LegacyReviewPanel() {
  const [result, setResult] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  async function review(file?: File) {
    setPage(1);
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
          {!!result.proposals.length && (
            <details>
              <summary>Conciliación por folio</summary>
              <p>
                Los importes se muestran en la moneda de origen. La diferencia
                es el cálculo actual menos el valor histórico. El IVA usado es
                el guardado en la propuesta.
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Folio e ID",
                        "Total histórico",
                        "Total recalculado",
                        "Diferencia total",
                        "Diferencia subtotal",
                        "Diferencia descuento",
                        "IVA histórico",
                        "Revisión",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.proposals
                      .slice((page - 1) * 25, page * 25)
                      .map((r, i) => (
                        <tr key={i}>
                          <th>
                            {r.folio || "Sin folio"} · {r.id || "Sin ID"}
                          </th>
                          {r.comparison ? (
                            <>
                              {[
                                r.comparison.historical,
                                r.comparison.calculated,
                                r.comparison.delta,
                                r.comparison.subtotalDelta,
                                r.comparison.discountDelta,
                                r.comparison.tax,
                              ].map((v, j) => (
                                <td key={j}>{v}</td>
                              ))}
                              <td>
                                {r.comparison.differences
                                  ? "Con diferencias"
                                  : "Coincidente"}
                                {r.comparison.percentage
                                  ? " · Revisar porcentaje"
                                  : ""}
                              </td>
                            </>
                          ) : (
                            <td colSpan={7}>
                              Partidas o importes no verificables
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <nav aria-label="Páginas de conciliación">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </button>{" "}
                Página {page} de {Math.ceil(result.proposals.length / 25)}{" "}
                <button
                  type="button"
                  disabled={page * 25 >= result.proposals.length}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </button>
              </nav>
            </details>
          )}
          {(
            [
              ["servicios", result.services],
              ["presets", result.presets],
              ["conceptos", result.concepts],
            ] as const
          ).map(
            ([label, records]) =>
              records.length > 0 && (
                <details key={label}>
                  <summary>Identificadores de {label} para staging</summary>
                  <ul>
                    {records.map((r, i) => (
                      <li key={i}>
                        {r.name} · <code>{r.id}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              ),
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

"use client";
import { useState } from "react";
import { verifyWorkspaceExport } from "@/shared/db/workspace-export";
export function WorkspaceExportCheck() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function check(file?: File) {
    setMessage("");
    if (!file) return;
    setBusy(true);
    try {
      const result = await verifyWorkspaceExport(file);
      setMessage(
        `Huella y conteos verificados. Estudio ${result.organization} · ${result.exportedAt} · ${result.collections} colecciones · ${result.records} registros.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Archivo inválido.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Comprobar un archivo descargado</summary>
      <p>
        El navegador contrasta los bytes del archivo con la huella de su nombre
        y revisa los conteos por colección.
      </p>
      <label>
        Archivo JSON del despacho
        <input
          type="file"
          accept=".json"
          disabled={busy}
          onChange={(e) => void check(e.target.files?.[0])}
        />
      </label>
      <p role="status">{busy ? "Verificando…" : message}</p>
    </details>
  );
}

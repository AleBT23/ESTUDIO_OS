import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/shared/auth/context";
import { RecordForm } from "@/shared/ui/record-form";
import { stageHistoricalQuote } from "@/modules/crm/stage-historical-quote";
export default async function HistoricalArchive({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; id?: string }>;
}) {
  const ctx = await requireContext();
  if (process.env.APP_ENV !== "staging" || ctx.membership.role !== "owner")
    notFound();
  const params = await searchParams,
    page = Math.max(1, Math.min(10000, parseInt(params.page ?? "1") || 1));
  const source = () => ctx.db.from("legacy_proposal_archive");
  const [list, selected] = await Promise.all([
    source()
      .select("legacy_id,folio,client_id")
      .eq("organization_id", ctx.organization.id)
      .order("imported_at", { ascending: false })
      .order("legacy_id")
      .range((page - 1) * 20, page * 20),
    params.id
      ? source()
          .select("folio,payload,source_checksum,settings_currency")
          .eq("organization_id", ctx.organization.id)
          .eq("legacy_id", params.id)
          .maybeSingle()
      : null,
  ]);
  return (
    <>
      <header className="page-heading">
        <Link href="/configuracion">Configuración</Link>
        <h1>Archivo histórico de propuestas</h1>
        <p>
          Conserva el contenido y la huella de origen para cotejar propuestas
          del tabulador. Los cobros y las obligaciones se registran por separado
          en Administración.
        </p>
      </header>
      <RecordForm
        id="archive"
        save={stageHistoricalQuote}
        submitLabel="Archivar en staging"
      >
        <label>
          Exportación JSON
          <input type="file" name="file" accept=".json" required />
        </label>
        <label>
          Identificador histórico de la propuesta
          <input name="legacy_id" required maxLength={160} />
        </label>
      </RecordForm>
      <section className="panel padded">
        <h2>Propuestas archivadas</h2>
        {list.error ? (
          <p role="alert">No se pudo consultar el archivo.</p>
        ) : !list.data.length ? (
          <p>Sin propuestas en esta página.</p>
        ) : (
          <ul>
            {list.data.slice(0, 20).map((r) => (
              <li key={r.legacy_id}>
                <Link
                  href={
                    "?" +
                    new URLSearchParams({ page: String(page), id: r.legacy_id })
                  }
                >
                  {r.folio} · {r.legacy_id}
                </Link>{" "}
                ·{" "}
                {r.client_id
                  ? "Cliente vinculado por ID"
                  : "Sin vínculo con un cliente del directorio"}
              </li>
            ))}
          </ul>
        )}
        {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior</Link>}{" "}
        {(list.data?.length ?? 0) > 20 && (
          <Link href={"?page=" + (page + 1)}>Siguiente</Link>
        )}
      </section>
      {params.id &&
        (selected?.data ? (
          <section className="panel padded">
            <h2>{selected.data.folio}</h2>
            <p>
              Moneda de configuración al exportar:{" "}
              {selected.data.settings_currency ?? "Sin registrar"}
            </p>
            <p style={{ overflowWrap: "anywhere" }}>
              SHA-256 de la exportación: {selected.data.source_checksum}
            </p>
            <details>
              <summary>Consultar datos originales</summary>
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {JSON.stringify(selected.data.payload, null, 2)}
              </pre>
            </details>
          </section>
        ) : (
          <p role="status">Propuesta no disponible.</p>
        ))}
    </>
  );
}

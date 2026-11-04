import Link from "next/link";
import { RecordForm } from "@/shared/ui/record-form";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial, canReadFinance } from "@/shared/permissions";
import { saveJournal } from "./actions";
const categories = {
  client: {
    call: "Llamada",
    email: "Correo",
    meeting: "Reunión",
    message: "Mensaje",
  },
  work: {
    visit: "Visita",
    progress: "Avance",
    incident: "Incidencia",
    decision: "Decisión",
  },
};
export async function Journal({
  scope,
  id,
  page,
  writable = true,
}: {
  scope: "work" | "client";
  id: string;
  page: number;
  writable?: boolean;
}) {
  const ctx = await requireContext(),
    work = scope === "work";
  if (!(work ? canReadFinance : canManageCommercial)(ctx.membership.role))
    return null;
  const kinds: Record<string, string> = categories[scope];
  const { data, error, count } = await ctx.db
    .from("journal_entries")
    .select("id,kind,occurred_on,body", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .eq(work ? "work_id" : "client_id", id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  const href = (n: number) =>
    (work ? "/obras?obra=" + id + "&" : "/comercial/clientes/" + id + "?") +
    "historial=" +
    n +
    "#bitacora";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.organization.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <section className="panel padded" id="bitacora">
      <h2>{work ? "Bitácora de obra" : "Historial de comunicaciones"}</h2>
      {error ? (
        <p>No se pudo consultar el historial.</p>
      ) : data.length ? (
        data.map((r) => (
          <article key={r.id} className="activity-row">
            <strong>
              {kinds[r.kind]} · {r.occurred_on}
            </strong>
            <p className="note-body">{r.body}</p>
          </article>
        ))
      ) : (
        <p>Sin entradas en esta página.</p>
      )}
      {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
      {page * 20 < (count ?? 0) && <Link href={href(page + 1)}>Siguiente</Link>}
      {writable && !error && (
        <details>
          <summary>Agregar entrada</summary>
          <RecordForm
            save={saveJournal.bind(null, scope)}
            id={crypto.randomUUID()}
          >
            <input type="hidden" name="parent" value={id} />
            <label>
              Tipo
              <select name="kind">
                {Object.entries(kinds).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha
              <input
                type="date"
                name="occurred_on"
                defaultValue={today}
                required
              />
            </label>
            <label className="full">
              Descripción
              <textarea name="body" maxLength={6000} required />
            </label>
          </RecordForm>
        </details>
      )}
    </section>
  );
}

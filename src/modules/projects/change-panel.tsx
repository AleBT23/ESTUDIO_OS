import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import { RecordForm } from "@/shared/ui/record-form";
import { saveChange } from "./change-action";
const states: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aprobada",
  rejected: "Rechazada",
  expired: "Vencida",
};
export async function Changes({
  project,
  client,
  page,
}: {
  project: string;
  client: string;
  page: number;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role)) return null;
  const org = ctx.organization.id;
  const [changes, quotes] = await Promise.all([
    ctx.db
      .from("scope_change_statement")
      .select("*", { count: "exact" })
      .eq("organization_id", org)
      .eq("project_id", project)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 20, page * 20 - 1),
    ctx.db
      .from("quotes")
      .select("id,name")
      .eq("organization_id", org)
      .eq("client_id", client)
      .eq("status", "draft")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
  ]);
  if (changes.error || quotes.error)
    return (
      <p className="notice">No se pudieron consultar los cambios de alcance.</p>
    );
  return (
    <section className="panel padded" id="cambios">
      <h2>Cambios de alcance</h2>
      <details>
        <summary>Solicitar cambio</summary>
        <RecordForm
          id={crypto.randomUUID()}
          save={saveChange.bind(null, "request")}
        >
          <input type="hidden" name="project_id" value={project} />
          <input type="hidden" name="client_id" value={client} />
          <label className="full">
            Alcance adicional
            <textarea name="description" required maxLength={6000} />
          </label>
          <label>
            Impacto en el plazo (días)
            <input
              type="number"
              step="1"
              name="days_impact"
              min="-3650"
              max="3650"
              defaultValue="0"
              required
            />
          </label>
        </RecordForm>
      </details>
      {changes.data.length ? (
        changes.data.map((c) => {
          return (
            <article key={c.id} className="activity-row">
              <p className="note-body">{c.description}</p>
              <small>Impacto en plazo · {c.days_impact} días</small>
              {c.quote_id ? (
                <p>
                  <Link href={"/comercial/cotizaciones/" + c.quote_id}>
                    {c.quote_name}
                  </Link>{" "}
                  · {c.quote_deleted_at ? "Archivada" : states[c.quote_status]}{" "}
                  · {formatMoney(BigInt(c.quote_total))}
                </p>
              ) : (
                <details>
                  <summary>Vincular cotización complementaria</summary>
                  <p>
                    <Link href="/comercial/cotizaciones/nueva">
                      Preparar una cotización
                    </Link>{" "}
                    para el mismo cliente. Al aceptar el extra, sus paquetes y
                    obligaciones se incorporan a este proyecto.
                  </p>
                  <RecordForm id={c.id} save={saveChange.bind(null, "bind")}>
                    <input type="hidden" name="project_id" value={project} />
                    <label>
                      Borrador
                      <select name="quote_id" required>
                        <option value="">Seleccionar</option>
                        {quotes.data.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </RecordForm>
                </details>
              )}
              {c.scheduled !== null && (
                <dl className="finance-summary">
                  {[
                    ["Programado vigente", c.scheduled],
                    ["Cobrado por esta ampliación", c.received],
                    ["Pendiente de cobro", c.outstanding],
                    ["Saldo cancelado", c.cancelled],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{formatMoney(BigInt(value))}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          );
        })
      ) : (
        <p>Sin solicitudes en esta página.</p>
      )}
      {page > 1 && (
        <Link href={"?cambios=" + (page - 1) + "#cambios"}>Anterior </Link>
      )}
      {page * 20 < (changes.count ?? 0) && (
        <Link href={"?cambios=" + (page + 1) + "#cambios"}>Siguiente</Link>
      )}
    </section>
  );
}

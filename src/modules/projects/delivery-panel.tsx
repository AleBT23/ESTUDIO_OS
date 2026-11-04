import { PublishDelivery } from "@/modules/portal/manage";
import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject, canManageCommercial } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { saveDelivery } from "./delivery-actions";
const states: Record<string, string> = {
  pending: "Pendiente",
  review: "En revisión",
  changes: "Con observaciones",
  approved: "Aprobado",
};
export async function DeliveryPanel({
  id,
  page,
  selected,
  historyPage,
}: {
  id: string;
  page: number;
  selected?: string;
  historyPage: number;
}) {
  const ctx = await requireContext(),
    org = ctx.organization.id,
    canWrite = canWriteProject(ctx.membership.role);
  const [list, members] = await Promise.all([
    ctx.db
      .from("deliverable_status")
      .select("*", { count: "exact" })
      .eq("organization_id", org)
      .eq("project_id", id)
      .order("due_on")
      .order("id")
      .range((page - 1) * 20, page * 20 - 1),
    canWrite
      ? ctx.db
          .from("memberships")
          .select("user_id,role")
          .eq("organization_id", org)
          .order("created_at")
      : null,
  ]);
  if (list.error)
    return <p className="notice">No se pudieron consultar los entregables.</p>;
  const current = list.data.find((d) => d.id === selected);
  const history = current
    ? await ctx.db
        .from("deliverable_revisions")
        .select("id,revision,state,notes,resource_url,created_at", {
          count: "exact",
        })
        .eq("organization_id", org)
        .eq("project_id", id)
        .eq("deliverable_id", current.id)
        .order("revision", { ascending: false })
        .range((historyPage - 1) * 20, historyPage * 20 - 1)
    : null;
  const href = (n: number, sel = "", rev = 1) =>
    "?entregas=" +
    n +
    "&entrega=" +
    sel +
    "&revisiones=" +
    rev +
    "#entregables";
  const who = (uid: string | null) =>
    !uid
      ? "Sin asignar"
      : uid === ctx.user.id
        ? "Mi cuenta"
        : "Miembro " + uid.slice(0, 8);
  return (
    <section className="panel padded" id="entregables">
      <h2>Etapas y entregables</h2>
      {list.data.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Etapa",
                  "Entregable",
                  "Entrega",
                  "Responsable",
                  "Estado",
                ].map((v) => (
                  <th key={v}>{v}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.map((d) => (
                <tr key={d.id}>
                  <td>{d.stage}</td>
                  <td>
                    <Link href={href(page, d.id)}>{d.name}</Link>
                  </td>
                  <td>{d.due_on}</td>
                  <td>{who(d.assignee)}</td>
                  <td>{states[d.state]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Sin entregables en esta página.</p>
      )}
      {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
      {page * 20 < (list.count ?? 0) && (
        <Link href={href(page + 1)}>Siguiente</Link>
      )}
      {canWrite && (
        <details>
          <summary>Agregar entregable</summary>
          <RecordForm
            save={saveDelivery.bind(null, "delivery")}
            id={crypto.randomUUID()}
          >
            <input type="hidden" name="project_id" value={id} />
            <label>
              Etapa
              <input name="stage" required maxLength={120} />
            </label>
            <label>
              Nombre del entregable
              <input name="name" required maxLength={200} />
            </label>
            <label>
              Fecha de entrega
              <input name="due_on" type="date" required />
            </label>
            <label>
              Responsable
              <select name="assignee">
                <option value="">Sin asignar</option>
                {members?.data?.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {who(m.user_id)} · {m.role}
                  </option>
                ))}
              </select>
            </label>
          </RecordForm>
        </details>
      )}
      {current && (
        <>
          {current.state === "approved" && (
            <PublishDelivery project={id} delivery={current.id} />
          )}
          <h3>{current.name} · Historial de revisiones</h3>
          {history?.error ? (
            <p>No se pudo cargar el historial.</p>
          ) : history?.data?.length ? (
            history.data.map((r) => (
              <article className="activity-row" key={r.id}>
                <strong>
                  Revisión {r.revision} · {states[r.state]}
                </strong>
                <p>{r.notes}</p>
                {r.resource_url && /^https:\/\//i.test(r.resource_url) && (
                  <a href={r.resource_url} target="_blank" rel="noreferrer">
                    Abrir documento de la revisión
                  </a>
                )}
              </article>
            ))
          ) : (
            <p>Sin revisiones en esta página.</p>
          )}
          {historyPage > 1 && (
            <Link href={href(page, current.id, historyPage - 1)}>
              Más recientes{" "}
            </Link>
          )}
          {historyPage * 20 < (history?.count ?? 0) && (
            <Link href={href(page, current.id, historyPage + 1)}>
              Anteriores
            </Link>
          )}
          {canWrite && current.state !== "approved" && (
            <details>
              <summary>Registrar revisión</summary>
              <RecordForm
                save={saveDelivery.bind(null, "revision")}
                id={crypto.randomUUID()}
              >
                <input type="hidden" name="project_id" value={id} />
                <input type="hidden" name="deliverable_id" value={current.id} />
                <input
                  type="hidden"
                  name="revision"
                  value={current.revision + 1}
                />
                <label>
                  Estado
                  <select name="state">
                    <option value="review">Enviar a revisión</option>
                    {current.state === "review" &&
                      canManageCommercial(ctx.membership.role) && (
                        <>
                          <option value="changes">Solicitar cambios</option>
                          <option value="approved">Aprobar</option>
                        </>
                      )}
                  </select>
                </label>
                <label>
                  Enlace al documento
                  <input
                    name="resource_url"
                    type="url"
                    placeholder="https://"
                    maxLength={2000}
                  />
                </label>
                <label className="full">
                  Notas
                  <textarea name="notes" maxLength={4000} required />
                </label>
              </RecordForm>
            </details>
          )}
        </>
      )}
    </section>
  );
}

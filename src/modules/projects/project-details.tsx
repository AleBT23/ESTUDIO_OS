import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { editProjectDetails } from "./details-action";
const states: Record<string, string> = {
  active: "Activo",
  paused: "Pausado",
  closed: "Cerrado",
  archived: "Archivado",
};
type Details = {
  id: string;
  name: string;
  location: string;
  state: string;
  start_date: string;
  target_end: string | null;
  lead_id: string | null;
  version: number;
};
export async function ProjectDetails({ project: p }: { project: Details }) {
  const ctx = await requireContext(),
    editable = canManageCommercial(ctx.membership.role);
  const members = editable
    ? await ctx.db
        .from("memberships")
        .select("user_id,role")
        .eq("organization_id", ctx.organization.id)
        .order("user_id")
    : null;
  const name = (id: string) =>
    id === ctx.user.id ? "Mi cuenta" : "Miembro " + id.slice(0, 8);
  return (
    <section id="ficha" className="panel padded">
      <h2>Ficha del proyecto</h2>
      <dl className="detail-list">
        {[
          ["Estado", states[p.state]],
          ["Ubicación", p.location || "Sin registrar"],
          ["Inicio", p.start_date],
          ["Cierre previsto", p.target_end ?? "Sin fecha"],
          ["Responsable", p.lead_id ? name(p.lead_id) : "Sin asignar"],
        ].map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {members?.error ? (
        <p>No se pudo cargar el equipo para editar.</p>
      ) : (
        editable && (
          <details>
            <summary>Editar ficha</summary>
            <RecordForm key={p.version} id={p.id} save={editProjectDetails}>
              <input type="hidden" name="version" value={p.version} />
              <label>
                Nombre
                <input
                  name="title"
                  defaultValue={p.name}
                  required
                  minLength={2}
                  maxLength={200}
                />
              </label>
              <label>
                Ubicación
                <input name="site" defaultValue={p.location} maxLength={500} />
              </label>
              <label>
                Fecha de inicio
                <input
                  type="date"
                  name="start_on"
                  required
                  defaultValue={p.start_date}
                />
              </label>
              <label>
                Cierre previsto
                <input
                  type="date"
                  name="end_on"
                  defaultValue={p.target_end ?? ""}
                />
              </label>
              <label>
                Responsable
                <select name="lead" defaultValue={p.lead_id ?? ""}>
                  <option value="">Sin asignar</option>
                  {p.lead_id &&
                    !members?.data?.some((m) => m.user_id === p.lead_id) && (
                      <option value={p.lead_id}>{name(p.lead_id)}</option>
                    )}
                  {members?.data?.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {name(m.user_id)} · {m.role}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Estado
                <select name="project_state" defaultValue={p.state}>
                  {Object.entries(states).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </RecordForm>
          </details>
        )
      )}
    </section>
  );
}

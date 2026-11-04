import { requireContext } from "@/shared/auth/context";
import { canManageCommercial, canWriteProject } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { savePhaseTemplate, applyPhasePlan, movePhase } from "./phase-actions";
export async function PhasePanel({ project }: { project: string }) {
  const ctx = await requireContext(),
    org = ctx.organization.id,
    manage = canManageCommercial(ctx.membership.role),
    write = canWriteProject(ctx.membership.role);
  const [templates, plans, services] = await Promise.all([
    ctx.db
      .from("phase_templates")
      .select("id,name,business_line_id,service_id,phases,version")
      .eq("organization_id", org)
      .order("name"),
    ctx.db
      .from("project_phase_plans")
      .select("id,name,phases,template_id,template_version,completed")
      .eq("organization_id", org)
      .eq("project_id", project)
      .order("name"),
    manage
      ? ctx.db
          .from("services")
          .select("id,name,business_line_id")
          .eq("organization_id", org)
          .is("deleted_at", null)
          .order("name")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (templates.error || plans.error || services.error)
    return <p className="notice">No se pudieron cargar las fases.</p>;
  const assigned = new Set(plans.data.map((p) => p.template_id));
  return (
    <section id="fases" className="panel padded">
      <h2>Fases del proyecto</h2>
      {!plans.data.length && (
        <p>Elige una plantilla para incorporar un plan de trabajo.</p>
      )}
      {plans.data.map((p) => (
        <article key={p.id}>
          <h3>
            {p.name} · v{p.template_version}
          </h3>
          <ol>
            {(p.phases as string[]).map((s, i) => (
              <li key={i}>
                {s} ·{" "}
                {i < p.completed
                  ? "Completada"
                  : i === p.completed
                    ? "En curso"
                    : "Pendiente"}
              </li>
            ))}
          </ol>
          {write && (
            <RecordForm id={p.id} save={movePhase}>
              <input type="hidden" name="project_id" value={project} />
              <input type="hidden" name="completed" value={p.completed} />
              <label>
                Actualizar avance
                <select name="delta" key={p.completed}>
                  {p.completed < p.phases.length && (
                    <option value="1">Completar fase en curso</option>
                  )}
                  {p.completed > 0 && (
                    <option value="-1">Reabrir fase anterior</option>
                  )}
                </select>
              </label>
            </RecordForm>
          )}
        </article>
      ))}
      {write && (
        <details>
          <summary>Plantillas por línea y servicio</summary>
          {templates.data.map((t) => (
            <article key={t.id}>
              <h3>
                {t.name} · v{t.version}
              </h3>
              <p>
                {ctx.lines.find((l) => l.id === t.business_line_id)?.name}{" "}
                {services.data.find((s) => s.id === t.service_id)?.name}
              </p>
              <ol>
                {(t.phases as string[]).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {!assigned.has(t.id) && (
                <RecordForm id={crypto.randomUUID()} save={applyPhasePlan}>
                  <input name="project_id" type="hidden" value={project} />
                  <input name="template_id" type="hidden" value={t.id} />
                  <input
                    name="template_version"
                    type="hidden"
                    value={t.version}
                  />
                  <p>Aplicar estas fases al proyecto</p>
                </RecordForm>
              )}
              {manage && (
                <details>
                  <summary>Editar plantilla</summary>
                  <RecordForm
                    key={t.version}
                    id={t.id}
                    save={savePhaseTemplate}
                  >
                    <input type="hidden" name="version" value={t.version} />
                    <label>
                      Nombre
                      <input name="name" defaultValue={t.name} required />
                    </label>
                    <label>
                      Fases en orden
                      <textarea
                        name="phases"
                        rows={5}
                        defaultValue={t.phases.join("\n")}
                        required
                      />
                    </label>
                  </RecordForm>
                </details>
              )}
            </article>
          ))}
          {manage && (
            <details>
              <summary>Crear plantilla de fases</summary>
              <RecordForm id={crypto.randomUUID()} save={savePhaseTemplate}>
                <input type="hidden" name="version" value="0" />
                <label>
                  Línea o servicio
                  <select name="scope">
                    {ctx.lines.map((l) => (
                      <optgroup key={l.id} label={l.name}>
                        <option value={l.id}>{l.name} · General</option>
                        {services.data
                          .filter((s) => s.business_line_id === l.id)
                          .map((s) => (
                            <option key={s.id} value={l.id + "/" + s.id}>
                              {s.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label>
                  Nombre
                  <input name="name" required />
                </label>
                <label>
                  Fases, una por línea
                  <textarea name="phases" rows={5} required />
                </label>
              </RecordForm>
            </details>
          )}
        </details>
      )}
    </section>
  );
}

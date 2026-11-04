import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial, canWriteProject } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import {
  createProcedure,
  startProcedure,
  setProcedureStep,
} from "@/modules/resources/procedure-actions";
export default async function ProceduresPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireContext(),
    org = ctx.organization.id;
  const page = Math.min(
    10000,
    Math.max(1, parseInt((await searchParams).page || "1") || 1),
  );
  const [procedures, runs, projects] = await Promise.all([
    ctx.db
      .from("studio_procedures")
      .select("id,name,steps")
      .eq("organization_id", org)
      .order("name"),
    ctx.db
      .from("procedure_runs")
      .select(
        "id,name,studio_procedures!inner(name,steps),projects(name),procedure_checks(step)",
        { count: "exact" },
      )
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 20, page * 20 - 1),
    ctx.db
      .from("projects")
      .select("id,name")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .order("name"),
  ]);
  if (procedures.error || runs.error || projects.error)
    throw Error("No se pudieron cargar los procedimientos.");
  const writable = canWriteProject(ctx.membership.role);
  type Run = {
    id: string;
    name: string;
    studio_procedures: { name: string; steps: string[] };
    projects: { name: string } | null;
    procedure_checks: { step: number }[];
  };
  return (
    <>
      <Link href="/recursos">Recursos</Link>
      <h1>Procedimientos y listas de verificación</h1>
      {canManageCommercial(ctx.membership.role) && (
        <details>
          <summary>Crear procedimiento reutilizable</summary>
          <RecordForm id={crypto.randomUUID()} save={createProcedure}>
            <label>
              Nombre
              <input required name="name" maxLength={160} />
            </label>
            <label>
              Pasos en orden, uno por línea
              <textarea required rows={6} name="steps" />
            </label>
          </RecordForm>
        </details>
      )}
      <h2>Procedimientos disponibles</h2>
      {!procedures.data.length && <p>Aún no hay procedimientos.</p>}
      {procedures.data.map((p) => (
        <details key={p.id}>
          <summary>{p.name}</summary>
          <ol>
            {(p.steps as string[]).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      ))}
      {writable && procedures.data.length > 0 && (
        <>
          <h2>Iniciar lista</h2>
          <RecordForm id={crypto.randomUUID()} save={startProcedure}>
            <label>
              Procedimiento
              <select name="procedure_id">
                {procedures.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nombre de esta ejecución
              <input name="name" required maxLength={160} />
            </label>
            <label>
              Proyecto
              <select name="project_id">
                <option value="">Sin proyecto</option>
                {projects.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </RecordForm>
        </>
      )}
      <h2>Listas del estudio</h2>
      {!runs.data.length && <p>Aún no se han iniciado listas.</p>}
      {(runs.data as unknown as Run[]).map((r) => {
        const steps = r.studio_procedures.steps,
          done = new Set(r.procedure_checks.map((c) => c.step));
        return (
          <section className="panel padded" key={r.id}>
            <h3>{r.name}</h3>
            <p>
              {r.studio_procedures.name} · {r.projects?.name || "Sin proyecto"}{" "}
              · {done.size}/{steps.length} completados
            </p>
            <ol>
              {steps.map((s, i) => (
                <li key={i}>
                  {s} · {done.has(i + 1) ? "Completado" : "Pendiente"}
                  {writable && (
                    <form action={setProcedureStep}>
                      <input type="hidden" name="run_id" value={r.id} />
                      <input type="hidden" name="step" value={i + 1} />
                      <button
                        className="button"
                        name="done"
                        value={done.has(i + 1) ? "no" : "yes"}
                      >
                        {done.has(i + 1) ? "Reabrir" : "Completar"}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
      {page * 20 < (runs.count || 0) && (
        <Link href={"?page=" + (page + 1)}>Siguiente</Link>
      )}
    </>
  );
}

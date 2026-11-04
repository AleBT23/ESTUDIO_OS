import { RecordForm } from "@/shared/ui/record-form";
import { saveWorkPackage } from "./package-action";
type Package = {
  id: string;
  name: string;
  version: number;
  execution_notes: string;
  business_line_id: string;
};
export function PackageForm({
  project,
  lines,
  existing,
}: {
  project: string;
  lines: { id: string; name: string }[];
  existing?: Package;
}) {
  return (
    <details>
      <summary>
        {existing ? "Editar datos operativos" : "Agregar paquete de trabajo"}
      </summary>
      <RecordForm
        key={existing?.version}
        id={existing?.id ?? crypto.randomUUID()}
        save={saveWorkPackage}
      >
        <input name="project" type="hidden" value={project} />
        <input name="version" type="hidden" value={existing?.version ?? 0} />
        {existing ? (
          <input type="hidden" name="line" value={existing.business_line_id} />
        ) : (
          <label>
            Línea de negocio
            <select name="line" required defaultValue="">
              <option value="">Elegir línea</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Nombre del paquete
          <input
            name="title"
            minLength={2}
            maxLength={160}
            defaultValue={existing?.name}
            required
          />
        </label>
        <label>
          Instrucciones de ejecución
          <textarea
            name="instructions"
            maxLength={6000}
            defaultValue={existing?.execution_notes}
          />
        </label>
      </RecordForm>
    </details>
  );
}

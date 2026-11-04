import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { storeTemplate } from "./template-action";
export async function TemplatePanel({
  source,
  version,
}: {
  source: string;
  version: number;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role)) return null;
  const { data, error } = await ctx.db
    .from("latest_document_templates")
    .select("id,name,version")
    .eq("organization_id", ctx.organization.id)
    .order("name");
  if (error)
    return (
      <p className="notice">No se pudieron cargar las opciones de plantilla.</p>
    );
  const fields = (
    <>
      <input type="hidden" name="source_id" value={source} />
      <input type="hidden" name="source_version" value={version} />
    </>
  );
  return (
    <section className="panel padded">
      <h2>Guardar como plantilla</h2>
      <p>
        La plantilla copia el título, el cuerpo y los márgenes. Revisa el texto
        para retirar los datos específicos de este encargo antes de guardarla.
      </p>
      <details>
        <summary>Crear plantilla</summary>
        <RecordForm id={crypto.randomUUID()} save={storeTemplate}>
          {fields}
          <label>
            Nombre
            <input name="name" required maxLength={160} />
          </label>
          <input type="hidden" name="version" value="1" />
        </RecordForm>
      </details>
      {data.length > 0 && (
        <details>
          <summary>Publicar una versión de plantilla existente</summary>
          <RecordForm id={crypto.randomUUID()} save={storeTemplate}>
            {fields}
            <label>
              Plantilla
              <select name="base_id" required>
                {data.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · crear v{t.version + 1}
                  </option>
                ))}
              </select>
            </label>
          </RecordForm>
        </details>
      )}
    </section>
  );
}

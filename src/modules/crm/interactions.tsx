import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { RecordForm } from "@/shared/ui/record-form";
import { addInteraction } from "./pipeline-actions";
const channels: Record<string, string> = {
  call: "Llamada",
  meeting: "Reunión",
  email: "Correo",
  note: "Nota",
};
export async function Interactions({ id, page }: { id: string; page: number }) {
  const ctx = await requireContext();
  const offset = (page - 1) * 20;
  const { data, error } = await ctx.db
    .from("opportunity_interactions")
    .select("id,created_at,kind,body")
    .eq("organization_id", ctx.organization.id)
    .eq("opportunity_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + 20);
  const href = (n: number) =>
    `/comercial/pipeline?selected=${id}&historyPage=${n}#interacciones`;
  return (
    <section id="interacciones" className="panel padded">
      <h2>Historial de interacciones</h2>
      <RecordForm
        id={id}
        save={addInteraction}
        submitLabel="Registrar interacción"
      >
        <label>
          Tipo de interacción
          <select name="kind">
            {Object.entries(channels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Detalle
          <textarea name="body" maxLength={4000} required />
        </label>
      </RecordForm>
      {error ? (
        <p role="alert">No se pudo consultar el historial.</p>
      ) : (
        <>
          {data.length ? (
            <ol>
              {data.slice(0, 20).map((row) => (
                <li key={row.id}>
                  <strong>{channels[row.kind]}</strong> ·{" "}
                  <time dateTime={row.created_at}>
                    {new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: ctx.organization.timezone,
                    }).format(new Date(row.created_at))}
                  </time>
                  <p style={{ whiteSpace: "pre-wrap" }}>{row.body}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p>Sin interacciones en esta página.</p>
          )}
          {page > 1 && <Link href={href(page - 1)}>Más recientes</Link>}{" "}
          {data.length > 20 && <Link href={href(page + 1)}>Anteriores</Link>}
        </>
      )}
    </section>
  );
}

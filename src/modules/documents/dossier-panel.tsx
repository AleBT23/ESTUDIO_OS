import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial, canWriteProject } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { archiveDossierFile, saveDossierFile } from "./dossier-actions";

export async function DossierPanel({
  scope,
  parent,
  archived,
  inactive,
  page,
}: {
  scope: "client" | "project";
  parent: string;
  archived: boolean;
  inactive: boolean;
  page: number;
}) {
  const ctx = await requireContext();
  const manager = canManageCommercial(ctx.membership.role);
  if (scope === "client" && !manager) return null;
  const base =
    (scope === "client" ? "/comercial/clientes/" : "/proyectos/") + parent;
  const href = (arch: boolean, n: number) =>
    base + "?archivados=" + Number(arch) + "&archivos=" + n + "#archivos";
  const refs = (
    <>
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="parent" value={parent} />
    </>
  );
  let query = ctx.db
    .from("dossier_files")
    .select("id,title,url,filename,version")
    .eq("organization_id", ctx.organization.id)
    .eq(scope === "client" ? "client_id" : "project_id", parent);
  query = archived
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20);
  if (error) throw new Error("No se pudo consultar el expediente.");
  const rows = data ?? [];
  return (
    <section id="archivos" className="panel padded">
      <h2>Archivos del expediente</h2>
      <p>
        <Link href={href(false, 1)}>Vigentes</Link> ·{" "}
        <Link href={href(true, 1)}>Archivados</Link>
      </p>
      {!inactive &&
        !archived &&
        (manager || canWriteProject(ctx.membership.role)) && (
          <RecordForm
            save={saveDossierFile}
            id={crypto.randomUUID()}
            submitLabel="Añadir al expediente"
          >
            {refs}
            <label>
              Nombre
              <input name="title" minLength={2} maxLength={160} required />
            </label>
            <label>
              Enlace externo
              <input name="url" type="url" maxLength={2048} />
            </label>
            <label>
              Archivo privado (hasta 2 MiB)
              <input name="file" type="file" />
            </label>
          </RecordForm>
        )}
      {rows.length === 0 && <p>No hay archivos en esta página.</p>}
      {rows.slice(0, 20).map((row) => (
        <article key={row.id}>
          <h3>{row.title}</h3>
          {!archived && row.url && (
            <p>
              <a href={row.url} rel="noopener noreferrer">
                Abrir enlace
              </a>
            </p>
          )}
          {!archived && row.filename && (
            <p>
              <a href={"/api/expedientes/" + row.id}>
                Descargar {row.filename}
              </a>
            </p>
          )}
          {manager && (
            <RecordForm
              save={archiveDossierFile}
              id={row.id}
              submitLabel={archived ? "Restaurar" : "Archivar"}
            >
              {refs}
              <input
                type="hidden"
                name="intent"
                value={archived ? "restore" : "archive"}
              />
              <input type="hidden" name="version" value={row.version} />
            </RecordForm>
          )}
        </article>
      ))}
      {page > 1 && <Link href={href(archived, page - 1)}>Anterior </Link>}
      {rows.length > 20 && (
        <Link href={href(archived, page + 1)}>Siguiente</Link>
      )}
    </section>
  );
}

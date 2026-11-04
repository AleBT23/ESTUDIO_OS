import Link from "next/link";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { CommercialTabs } from "@/shared/ui/commercial-tabs";
import { RecordForm } from "@/shared/ui/record-form";
import { registerContract } from "@/modules/crm/contract-action";
export default async function Contracts({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; proyecto?: string; page?: string }>;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return <p className="notice">Permisos insuficientes.</p>;
  const q = await searchParams,
    org = ctx.organization.id,
    client = z.uuid().safeParse(q.cliente).success ? q.cliente : undefined,
    project = z.uuid().safeParse(q.proyecto).success ? q.proyecto : undefined;
  const page = Math.max(1, Math.min(10000, parseInt(q.page ?? "1") || 1));
  let query = ctx.db
    .from("contracts")
    .select(
      "id,title,reference,scope,signed_on,document_url,client_id,project_id,clients(name),projects(name,quote_version_id,quote_versions(quote_id))",
      { count: "exact" },
    )
    .eq("organization_id", org)
    .order("signed_on", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  if (client) query = query.eq("client_id", client);
  if (project) query = query.eq("project_id", project);
  const [list, clients, projects] = await Promise.all([
    query,
    ctx.db
      .from("clients")
      .select("id,name")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .order("name"),
    ctx.db
      .from("projects")
      .select("id,name,client_id")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .order("name"),
  ]);
  if (list.error || clients.error || projects.error)
    return (
      <p className="notice">
        No se pudieron cargar los contratos y sus expedientes.
      </p>
    );
  const projectClient = projects.data.find((p) => p.id === project)?.client_id;
  const href = (n: number) =>
    "?" +
    new URLSearchParams({
      ...(client ? { cliente: client } : {}),
      ...(project ? { proyecto: project } : {}),
      page: String(n),
    });
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">COMERCIAL</p>
        <h1>Contratos</h1>
      </header>
      <CommercialTabs active="/comercial/contratos" />
      <section className="panel padded">
        <h2>Contratos firmados</h2>
        {(client || project) && (
          <Link href="/comercial/contratos">Ver todos los contratos</Link>
        )}
        {list.data.length ? (
          list.data.map((row) => {
            const customer = row.clients as unknown as { name: string } | null,
              job = row.projects as unknown as {
                name: string;
                quote_versions: { quote_id: string } | null;
              } | null;
            return (
              <details key={row.id}>
                <summary>
                  {row.reference} · {row.title} · {row.signed_on}
                </summary>
                <p>
                  <Link href={"/comercial/clientes/" + row.client_id}>
                    {customer?.name ?? "Cliente"}
                  </Link>
                  {job && (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={"/proyectos/" + row.project_id}>
                        {job.name}
                      </Link>
                    </>
                  )}
                  {job?.quote_versions && (
                    <>
                      {" "}
                      ·{" "}
                      <Link
                        href={
                          "/comercial/cotizaciones/" +
                          job.quote_versions.quote_id
                        }
                      >
                        Cotización de origen
                      </Link>
                    </>
                  )}
                </p>
                <p className="note-body">{row.scope}</p>
                {row.document_url && (
                  <a href={row.document_url} target="_blank" rel="noreferrer">
                    Abrir documento firmado
                  </a>
                )}
              </details>
            );
          })
        ) : (
          <p>Sin contratos en esta página.</p>
        )}
        {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
        {page * 25 < (list.count ?? 0) && (
          <Link href={href(page + 1)}>Siguiente</Link>
        )}
      </section>
      <details>
        <summary>Registrar contrato firmado</summary>
        <RecordForm save={registerContract} id={crypto.randomUUID()}>
          <label>
            Cliente
            <select
              required
              name="client_id"
              defaultValue={client ?? projectClient ?? ""}
            >
              <option value="">Seleccionar</option>
              {clients.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Proyecto
            <select name="project_id" defaultValue={project ?? ""}>
              <option value="">Sin proyecto</option>
              {projects.data
                .filter((p) => !client || p.client_id === client)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Folio
            <input name="reference" maxLength={100} required />
          </label>
          <label>
            Título
            <input name="title" maxLength={180} required />
          </label>
          <label>
            Fecha de firma
            <input type="date" name="signed_on" required />
          </label>
          <label>
            Documento firmado (HTTPS)
            <input name="document_url" type="url" maxLength={2000} />
          </label>
          <label className="full">
            Servicios y alcance contratados
            <textarea name="scope" maxLength={12000} required />
          </label>
        </RecordForm>
      </details>
    </>
  );
}

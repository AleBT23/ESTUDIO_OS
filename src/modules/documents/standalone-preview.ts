import "server-only";
import { requireContext } from "@/shared/auth/context";
import { standaloneSnapshotSchema } from "./standalone-schema";
export async function standalonePreview(id: string) {
  const ctx = await requireContext();
  const doc = await ctx.db
    .from("studio_documents")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (doc.error || !doc.data) throw new Error("Documento no disponible.");
  const input = doc.data;
  const [client, project] = await Promise.all([
    input.client_id
      ? ctx.db
          .from("clients")
          .select("name")
          .eq("organization_id", ctx.organization.id)
          .eq("id", input.client_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    input.project_id
      ? ctx.db
          .from("projects")
          .select("name")
          .eq("organization_id", ctx.organization.id)
          .eq("id", input.project_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (client.error || project.error)
    throw new Error("No se pudo consultar el contexto del documento.");
  return standaloneSnapshotSchema.parse({
    ...input,
    folio: "BORRADOR",
    date: new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: ctx.organization.timezone,
    }).format(new Date()),
    organization: { name: ctx.organization.name },
    client: client.data,
    project: project.data,
  });
}

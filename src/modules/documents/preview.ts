import "server-only";
import { requireContext } from "@/shared/auth/context";
import { quoteSnapshotSchema, type DocumentOptions } from "./schema";
export async function previewSnapshot(id: string, options: DocumentOptions) {
  const ctx = await requireContext();
  const [header, items] = await Promise.all([
    ctx.db
      .from("quotes")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    ctx.db
      .from("quote_items")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .eq("quote_id", id)
      .order("position"),
  ]);
  if (header.error || items.error || !header.data)
    throw new Error("Propuesta no disponible.");
  const client = await ctx.db
    .from("clients")
    .select("name,email,phone,address")
    .eq("organization_id", ctx.organization.id)
    .eq("id", header.data.client_id)
    .single();
  if (client.error) throw new Error("Cliente no disponible.");
  return quoteSnapshotSchema.parse({
    folio: "BORRADOR · SIN EMITIR",
    issued_at: new Date().toISOString(),
    organization: { name: ctx.organization.name },
    client: client.data,
    quote: header.data,
    items: items.data,
    options,
  });
}

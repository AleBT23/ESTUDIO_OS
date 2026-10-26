import "server-only";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { redirect } from "next/navigation";
import type { Service } from "./schema";
export async function getEditorData() {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role)) redirect("/comercial");
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ctx.organization.timezone,
  }).format(new Date());
  const results = await Promise.all([
    ctx.db
      .from("clients")
      .select("id,name")
      .eq("organization_id", ctx.organization.id)
      .is("deleted_at", null)
      .order("name")
      .limit(500),
    ctx.db
      .from("services")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .is("deleted_at", null)
      .or(`valid_until.is.null,valid_until.gte.${today}`)
      .order("name")
      .limit(500),
    ctx.db
      .from("service_presets")
      .select("id,name,notes")
      .eq("organization_id", ctx.organization.id)
      .is("deleted_at", null)
      .order("name")
      .limit(500),
    ctx.db
      .from("preset_items")
      .select("preset_id,service_id,quantity,position")
      .eq("organization_id", ctx.organization.id)
      .order("position")
      .limit(10000),
    ctx.db
      .from("concepts")
      .select("id,name,body")
      .eq("organization_id", ctx.organization.id)
      .is("deleted_at", null)
      .order("name")
      .limit(500),
  ]);
  if (results.some((r) => r.error))
    throw new Error("No se pudieron cargar los datos de la propuesta.");
  return {
    ctx,
    clients: results[0].data || [],
    services: (results[1].data || []) as Service[],
    concepts: results[4].data || [],
    presets: (results[2].data || []).map((p) => ({
      ...p,
      items: (results[3].data || [])
        .filter((i) => i.preset_id === p.id)
        .map((i) => ({
          service_id: i.service_id,
          quantity: String(i.quantity),
        })),
    })),
    validUntil: new Date(
      new Date(`${today}T12:00:00Z`).getTime() + 14 * 86400000,
    )
      .toISOString()
      .slice(0, 10),
  };
}

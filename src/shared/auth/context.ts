import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { database, isConfigured } from "@/shared/db/server";
import type { Role } from "@/shared/permissions";
export const getContext = cache(async () => {
  if (!isConfigured()) return null;
  const db = await database();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return null;
  const result = await db
    .from("memberships")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (result.error)
    throw new Error(
      "No se pudo consultar el acceso al estudio. Revisa la conexión y las migraciones.",
    );
  const membership = result.data;
  if (!membership)
    return { db, user, membership: null, organization: null, lines: [] };
  const [org, lines] = await Promise.all([
    db
      .from("organizations")
      .select("id,name,timezone,currency")
      .eq("id", membership.organization_id)
      .single(),
    db
      .from("business_lines")
      .select("id,name")
      .eq("organization_id", membership.organization_id)
      .order("name"),
  ]);
  if (org.error || lines.error)
    throw new Error("No se pudo cargar tu estudio. Intenta de nuevo.");
  return {
    db,
    user,
    membership: { ...membership, role: membership.role as Role },
    organization: org.data,
    lines: lines.data,
  };
});
export async function requireContext() {
  const ctx = await getContext();
  if (!ctx) redirect("/acceso");
  if (!ctx.membership || !ctx.organization) redirect("/configuracion");
  return { ...ctx, membership: ctx.membership, organization: ctx.organization };
}

import "server-only";
import { cache } from "react";
import { getContext } from "@/shared/auth/context";
// Evita romper el trabajo existente mientras se activa una actualización de BD.
export const projectWorkspaceReady = cache(async () => {
  const ctx = await getContext();
  if (!ctx?.organization) return false;
  const result = await ctx.db
    .from("project_notes")
    .select("id")
    .eq("organization_id", ctx.organization.id)
    .limit(0);
  if (result.error && !["PGRST205", "42P01"].includes(result.error.code))
    throw new Error("No se pudo comprobar el acceso al expediente.");
  return !result.error;
});

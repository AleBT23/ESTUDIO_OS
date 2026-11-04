"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial, canReadFinance } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
const base = z.object({
  id: z.uuid(),
  parent: z.uuid(),
  occurred_on: z.iso.date(),
  body: z.string().trim().min(1).max(6000),
});
export async function saveJournal(
  scope: "work" | "client",
  _state: RecordState,
  data: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  const work = scope === "work";
  if (!(work ? canReadFinance : canManageCommercial)(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const schema = base.extend({
    kind: work
      ? z.enum(["visit", "progress", "incident", "decision"])
      : z.enum(["call", "email", "meeting", "message"]),
  });
  const parsed = schema.safeParse(Object.fromEntries(data));
  if (!parsed.success)
    return { error: "Revisa la fecha, el tipo y la descripción." };
  const { parent, ...fields } = parsed.data;
  const { error } = await ctx.db
    .from("journal_entries")
    .insert({
      ...fields,
      organization_id: ctx.organization.id,
      [work ? "work_id" : "client_id"]: parent,
    });
  if (error)
    return {
      error: "No se pudo guardar. Revisa el expediente antes de reintentar.",
    };
  revalidatePath(work ? "/obras" : "/comercial/clientes/" + parent);
  return { success: "Entrada guardada.", nextId: crypto.randomUUID() };
}

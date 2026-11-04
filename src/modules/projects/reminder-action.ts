"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";

const fields = z.object({
  label: z.string().trim().min(2).max(240),
  due_on: z.iso.date(),
  repeat_days: z
    .string()
    .regex(/^\d{1,3}$/)
    .transform(Number)
    .pipe(z.number().max(365)),
});
export async function saveReminder(
  _previous: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canWriteProject(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const raw = Object.fromEntries(form);
  const key = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().nonnegative(),
      intent: z.enum(["save", "complete"]),
    })
    .safeParse(raw);
  if (!key.success) return { error: "Identificador de recordatorio inválido." };
  const { id, version, intent } = key.data;
  const table = ctx.db.from("personal_reminders");
  const data = fields.safeParse(raw);
  if (intent === "save" && !data.success)
    return {
      error: "Revisa el asunto, la fecha y el intervalo (0 a 365 días).",
    };
  const org = ctx.organization.id;
  const result =
    version === 0 && data.success && intent === "save"
      ? await table
          .insert({ id, organization_id: org, ...data.data })
          .select("id")
          .single()
      : await table
          .update(intent === "complete" ? { completed: true } : data.data!)
          .eq("organization_id", org)
          .eq("user_id", ctx.user.id)
          .eq("id", id)
          .eq("version", version)
          .eq("completed", false)
          .select("id")
          .maybeSingle();
  if (result.error || !result.data)
    return {
      error:
        "No se guardó. Actualiza la agenda y comprueba la versión vigente.",
    };
  revalidatePath("/agenda", "layout");
  revalidatePath("/");
  return {
    success: "Recordatorio guardado.",
    ...(version === 0 ? { nextId: crypto.randomUUID() } : {}),
  };
}

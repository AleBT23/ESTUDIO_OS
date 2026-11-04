"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
export async function markNotification(form: FormData) {
  const ctx = await requireContext();
  const { id, kind, due_on, intent } = z
    .object({
      id: z.uuid(),
      kind: z.string().min(1).max(80),
      due_on: z.iso.date(),
      intent: z.enum(["read", "unread"]),
    })
    .parse(Object.fromEntries(form));
  const key = {
    organization_id: ctx.organization.id,
    event_id: id,
    kind,
    due_on,
  };
  const reads = ctx.db.from("agenda_notification_reads");
  const result =
    intent === "read"
      ? await reads.insert(key)
      : await reads.delete().match({ ...key, user_id: ctx.user.id });
  if (result.error && !(intent === "read" && result.error.code === "23505"))
    throw Error("El aviso ya no está disponible. Actualiza la bandeja.");
  revalidatePath("/");
  revalidatePath("/agenda/notificaciones");
}

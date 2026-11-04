"use server";
import { z } from "zod";
import { database } from "@/shared/db/server";
import type { RecordState } from "@/shared/ui/record-form";
export async function requestAccount(
  _state: RecordState,
  form: FormData,
): Promise<RecordState> {
  const input = z
    .object({
      email: z.email().max(254),
      password: z.string().min(12).max(128),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error:
        "Revisa el correo y utiliza al menos 12 caracteres en la contraseña.",
    };
  const db = await database(),
    { error } = await db.auth.signUp(input.data);
  if (error)
    return {
      error:
        "No se pudo solicitar la cuenta. Revisa los datos o contacta al estudio.",
    };
  return {
    success:
      "Si tu cuenta requiere confirmación, revisa tu correo. Después inicia sesión con ese correo.",
  };
}

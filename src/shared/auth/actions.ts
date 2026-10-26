"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { database, isConfigured } from "@/shared/db/server";
export type FormState = { error?: string; success?: string };
export async function signIn(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  if (!isConfigured())
    return { error: "Primero conecta la base de datos en Configuración." };
  const input = z
    .object({ email: z.email(), password: z.string().min(8).max(128) })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Revisa tu correo y contraseña (mínimo 8 caracteres)." };
  const db = await database();
  const { error } = await db.auth.signInWithPassword(input.data);
  if (error)
    return {
      error:
        "No se pudo iniciar sesión. Revisa tus datos o inténtalo más tarde.",
    };
  redirect("/");
}
export async function signOut() {
  const db = await database();
  await db.auth.signOut();
  redirect("/acceso");
}
export async function createWorkspace(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const input = z.string().trim().min(2).max(120).safeParse(form.get("name"));
  if (!input.success)
    return { error: "Escribe el nombre de tu estudio (2 a 120 caracteres)." };
  const db = await database();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "Inicia sesión para crear el estudio." };
  const { error } = await db.rpc("create_workspace", {
    workspace_name: input.data,
  });
  if (error)
    return {
      error:
        "No se pudo crear el estudio. Revisa si ya perteneces a uno y la conexión.",
    };
  redirect("/");
}

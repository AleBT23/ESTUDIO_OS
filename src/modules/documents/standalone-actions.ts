"use server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";
import {
  standaloneInputSchema,
  standaloneSnapshotSchema,
} from "./standalone-schema";
import { StandaloneRenderer } from "./standalone-renderer";
export async function saveStudioDocument(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Tu rol no permite editar documentos." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload")));
  } catch {
    return { error: "No se pudo leer el documento." };
  }
  const parsed = standaloneInputSchema.safeParse(raw);
  const identity = z
    .object({
      id: z.union([z.literal(""), z.uuid()]),
      version: z.coerce.number().int().nonnegative(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const variableIssue = parsed.error.issues.find((i) => i.code === "custom");
    return {
      error:
        variableIssue?.message ||
        "Revisa el título, el contenido y los márgenes del documento.",
    };
  }
  if (!identity.success) return { error: "Referencia de documento inválida." };
  const { data, error } = await ctx.db.rpc("save_studio_document", {
    org: ctx.organization.id,
    document: identity.data.id || null,
    expected_version: identity.data.version,
    header: parsed.data,
  });
  if (error)
    return {
      error:
        "No se guardó el documento. Revisa que cliente y proyecto correspondan; recarga si hubo una edición simultánea.",
    };
  revalidatePath("/recursos/documentos");
  redirect("/recursos/documentos?selected=" + data);
}
export async function issueStudioDocument(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Tu rol no permite emitir documentos." };
  const input = z
    .object({ id: z.uuid(), version: z.coerce.number().int().positive() })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Referencia inválida. Recarga el documento." };
  const { data, error } = await ctx.db.rpc("prepare_studio_document", {
    org: ctx.organization.id,
    document: input.data.id,
    expected_version: input.data.version,
  });
  if (error)
    return {
      error:
        "No se pudo preparar el documento; recarga si cambió desde que lo abriste.",
    };
  const prepared = z
    .object({
      id: z.uuid(),
      snapshot: standaloneSnapshotSchema,
      storage_path: z.string(),
      state: z.enum(["prepared", "issued"]),
    })
    .safeParse(data);
  if (!prepared.success)
    return { error: "La versión preparada no es válida. No se emitió el PDF." };
  if (prepared.data.state === "issued")
    return {
      success: "Esta edición ya fue emitida. Descarga su versión guardada.",
    };
  let bytes: Buffer;
  try {
    bytes = await new StandaloneRenderer().render(prepared.data.snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      error:
        message.startsWith("Faltan datos") ||
        message.startsWith("Variable no permitida") ||
        message.startsWith("Hay una variable")
          ? message
          : "No se pudo generar el documento. Revisa el contenido y las variables.",
    };
  }
  const stored = await ctx.db.storage
    .from("estudio-documents")
    .upload(prepared.data.storage_path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (stored.error)
    return {
      error:
        "No se pudo guardar el PDF privado. Revisa Storage y las versiones emitidas antes de repetir.",
    };
  const finalized = await ctx.db.rpc("finalize_studio_document", {
    org: ctx.organization.id,
    version_id: prepared.data.id,
    checksum: createHash("sha256").update(bytes).digest("hex"),
  });
  if (finalized.error) {
    await ctx.db.storage
      .from("estudio-documents")
      .remove([prepared.data.storage_path]);
    return {
      error:
        "No se confirmó la emisión. Recarga el documento y consulta sus versiones.",
    };
  }
  revalidatePath("/recursos/documentos");
  return {
    success: "Documento emitido con membrete y conservado de forma inmutable.",
  };
}

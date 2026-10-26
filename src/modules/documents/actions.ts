"use server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";
import { documentOptionsSchema, quoteSnapshotSchema } from "./schema";
import { ReactPdfRenderer } from "./pdf-renderer";
const identity = z.object({
  id: z.uuid(),
  version: z.coerce.number().int().positive(),
});
export async function issueQuote(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Tu rol no permite emitir propuestas." };
  const ids = identity.safeParse(Object.fromEntries(form));
  let options: unknown;
  try {
    options = JSON.parse(String(form.get("options")));
  } catch {
    return { error: "Revisa las opciones del documento." };
  }
  const settings = documentOptionsSchema.safeParse(options);
  if (!ids.success || !settings.success)
    return { error: "Revisa las secciones y los márgenes del documento." };
  const { data, error } = await ctx.db.rpc("prepare_quote_version", {
    org: ctx.organization.id,
    quote: ids.data.id,
    expected_version: ids.data.version,
    options: settings.data,
  });
  if (error)
    return {
      error:
        "No se pudo preparar la versión. El borrador pudo cambiar. Si ya preparaste esta edición con otras opciones, guarda una nueva edición antes de emitir.",
    };
  const prepared = z
    .object({
      id: z.uuid(),
      state: z.enum(["prepared", "issued"]),
      storage_path: z.string(),
      snapshot: quoteSnapshotSchema,
    })
    .safeParse(data);
  if (!prepared.success)
    return {
      error: "La versión preparada no es válida. No se emitió el documento.",
    };
  if (prepared.data.state === "issued")
    return {
      success:
        "Esta edición ya tiene un PDF inmutable. Descárgalo en Versiones emitidas.",
    };
  const document = prepared.data;
  let bytes: Buffer;
  try {
    bytes = await new ReactPdfRenderer().render(document.snapshot);
  } catch {
    return {
      error:
        "No se pudo generar el PDF. Revisa los importes y el contenido. No se marcó como emitido.",
    };
  }
  const uploaded = await ctx.db.storage
    .from("estudio-documents")
    .upload(document.storage_path, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploaded.error)
    return {
      error:
        "No se pudo guardar el PDF privado. Revisa Storage y vuelve a cargar las versiones; puede existir una emisión simultánea.",
    };
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const finalized = await ctx.db.rpc("finalize_quote_version", {
    org: ctx.organization.id,
    version_id: document.id,
    checksum,
  });
  if (finalized.error) {
    await ctx.db.storage
      .from("estudio-documents")
      .remove([document.storage_path]);
    return {
      error:
        "No se confirmó la emisión. El borrador pudo cambiar. Recarga las versiones antes de repetir.",
    };
  }
  revalidatePath(`/comercial/cotizaciones/${ids.data.id}`);
  return {
    success:
      "PDF emitido y guardado de forma inmutable. El envío al cliente se registra por separado.",
  };
}
export async function markSent(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = identity
    .extend({ issued_version: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Selecciona una versión emitida." };
  const { error } = await ctx.db.rpc("mark_quote_sent", {
    org: ctx.organization.id,
    quote: input.data.id,
    expected_version: input.data.version,
    version_id: input.data.issued_version,
  });
  if (error)
    return {
      error:
        "No se pudo registrar el envío. Emite la edición vigente o recarga si hubo cambios.",
    };
  revalidatePath(`/comercial/cotizaciones/${input.data.id}`);
  revalidatePath("/comercial/cotizaciones");
  return {
    success: "Envío registrado. No se envió correo desde la plataforma.",
  };
}
export async function acceptQuote(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = identity
    .extend({ advance_due: z.iso.date(), balance_due: z.iso.date() })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Revisa las fechas del plan de cobro." };
  const { data, error } = await ctx.db.rpc("accept_quote", {
    org: ctx.organization.id,
    quote: input.data.id,
    expected_version: input.data.version,
    advance_due: input.data.advance_due,
    balance_due: input.data.balance_due,
  });
  if (error)
    return {
      error:
        "No se pudo aceptar. Revisa la vigencia, el estado y las fechas, o recarga si hubo cambios.",
    };
  revalidatePath("/proyectos");
  revalidatePath("/administracion");
  revalidatePath("/comercial/cotizaciones");
  redirect(`/proyectos/${data}`);
}

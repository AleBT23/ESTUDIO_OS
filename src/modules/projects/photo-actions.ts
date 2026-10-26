"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
import {
  photoDescriptorsSchema,
  PHOTO_BUCKET,
  TEMP_PHOTO_BUCKET,
  type PreparedObservation,
  type ObservationResult,
} from "./photo-contract";
import {
  cleanupTemporaryPhotos,
  preparedPhotoRows,
  publishPreparedPhotos,
} from "./photo-publish";

const inputSchema = z.object({
  project: z.uuid(),
  body: z.string().trim().min(1).max(10000),
  observed_on: z.iso.date(),
});
export async function prepareObservation(
  form: FormData,
  descriptors: unknown,
  requestId: string,
): Promise<{
  plan?: PreparedObservation;
  error?: string;
  retryable?: boolean;
}> {
  const ctx = await requireContext();
  if (!canWriteProject(ctx.membership.role))
    return { error: "Tu rol solo permite consultar la bitácora." };
  // Ningún archivo ni campo voluminoso debe cruzar una Server Action.
  if ([...form.values()].some((value) => typeof value !== "string"))
    return {
      error:
        "Las fotografías deben enviarse directamente al almacenamiento privado.",
    };
  const input = inputSchema.safeParse(Object.fromEntries(form));
  const photos = photoDescriptorsSchema.safeParse(descriptors);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.organization.timezone,
  }).format(new Date());
  if (
    !input.success ||
    !photos.success ||
    !z.uuid().safeParse(requestId).success ||
    input.data.observed_on > today
  )
    return {
      error:
        "Revisa la observación, la fecha y las fotografías JPEG de hasta 2 MB (máximo cinco).",
    };
  const project = await ctx.db
    .from("projects")
    .select("id")
    .eq("id", input.data.project)
    .eq("organization_id", ctx.organization.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (project.error || !project.data)
    return { error: "El proyecto ya no está disponible para tu estudio." };
  const prepared = await ctx.db.rpc("prepare_project_observation", {
    org: ctx.organization.id,
    project: input.data.project,
    observation: requestId,
    visit_body: input.data.body,
    visit_date: input.data.observed_on,
    photo_sizes: photos.data.map((photo) => photo.size),
  });
  if (prepared.error || !prepared.data)
    return {
      retryable: true,
      error:
        "No se pudo preparar el registro. Revisa la conexión, el proyecto y la migración 011 antes de reintentar.",
    };
  return { plan: prepared.data as PreparedObservation };
}

async function ownObservation(id: string, allowMissing = false) {
  const ctx = await requireContext();
  if (!canWriteProject(ctx.membership.role))
    throw new Error("Tu rol solo permite consultar la bitácora.");
  if (!z.uuid().safeParse(id).success)
    throw new Error("Registro de visita inválido.");
  const row = await ctx.db
    .from("project_observations")
    .select("id,project_id,published")
    .eq("id", id)
    .eq("organization_id", ctx.organization.id)
    .eq("created_by", ctx.user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (row.error)
    throw new Error(
      "No se pudo consultar la observación. Vuelve a intentarlo.",
    );
  if (!row.data) {
    if (allowMissing) return { ctx, observation: null };
    throw new Error("La observación ya no está disponible para tu usuario.");
  }
  const project = await ctx.db
    .from("projects")
    .select("id")
    .eq("id", row.data.project_id)
    .eq("organization_id", ctx.organization.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (project.error || !project.data)
    throw new Error("El proyecto ya no está disponible para tu estudio.");
  return { ctx, observation: row.data };
}

export async function finishObservation(
  id: string,
): Promise<ObservationResult> {
  // requireContext queda fuera del manejo de errores para conservar redirects Auth.
  await requireContext();
  try {
    const { ctx, observation } = await ownObservation(id);
    if (!observation) throw new Error("La observación ya no está disponible.");
    let clean = true;
    if (!observation.published)
      clean = await publishPreparedPhotos(ctx.db, ctx.organization.id, id);
    else
      clean = await cleanupTemporaryPhotos(
        ctx.db,
        await preparedPhotoRows(ctx.db, ctx.organization.id, id),
      );
    revalidatePath(`/proyectos/${observation.project_id}`);
    return {
      nextRequestId: crypto.randomUUID(),
      published: true,
      success: clean
        ? "Observación y fotografías guardadas en la bitácora privada."
        : "Observación guardada. Quedó una copia temporal pendiente de limpieza; no vuelvas a crear el registro.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo confirmar el registro. Conserva el intento y vuelve a guardar.",
    };
  }
}

export async function cancelObservation(
  id: string,
): Promise<ObservationResult> {
  await requireContext();
  try {
    const { ctx, observation } = await ownObservation(id, true);
    if (!observation)
      return {
        nextRequestId: crypto.randomUUID(),
        success: "El intento ya fue descartado.",
      };
    if (observation.published)
      return {
        published: true,
        nextRequestId: crypto.randomUUID(),
        success: "La observación ya estaba publicada y se conservó.",
      };
    const rows = await preparedPhotoRows(ctx.db, ctx.organization.id, id);
    for (const bucket of [TEMP_PHOTO_BUCKET, PHOTO_BUCKET]) {
      if (!rows.length) continue;
      const removed = await ctx.db.storage
        .from(bucket)
        .remove(rows.map((row) => row.storage_path));
      if (removed.error)
        throw new Error(
          "No se pudo limpiar el intento. Conserva esta pantalla y reintenta descartarlo.",
        );
    }
    const discarded = await ctx.db.rpc("discard_project_observation", {
      org: ctx.organization.id,
      observation: id,
    });
    if (discarded.error)
      throw new Error(
        "No se confirmó el descarte. Vuelve a intentarlo antes de crear otro registro.",
      );
    return {
      nextRequestId: crypto.randomUUID(),
      success:
        "Intento descartado. El texto y las fotos permanecen en este dispositivo para volver a guardarlos.",
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo descartar el intento.",
    };
  }
}

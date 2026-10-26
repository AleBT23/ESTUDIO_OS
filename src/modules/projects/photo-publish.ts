import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoto } from "./photo-validation";
import { PHOTO_BUCKET, TEMP_PHOTO_BUCKET } from "./photo-contract";

type Photo = { id: string; storage_path: string; byte_size: number };
export async function preparedPhotoRows(
  db: SupabaseClient,
  org: string,
  observation: string,
) {
  const result = await db
    .from("project_photos")
    .select("id,storage_path,byte_size")
    .eq("organization_id", org)
    .eq("observation_id", observation)
    .order("id");
  if (result.error || !result.data || result.data.length > 5)
    throw new Error("No se pudieron consultar las fotografías preparadas.");
  return result.data as Photo[];
}

// No confía en MIME ni tamaños enviados por el navegador. Descarga, decodifica,
// normaliza sin EXIF y publica una copia canónica, sin upsert ni clave de servicio.
// Secuencial para limitar memoria: como máximo una imagen de 2 MiB en proceso.
export async function publishPreparedPhotos(
  db: SupabaseClient,
  org: string,
  observation: string,
) {
  const rows = await preparedPhotoRows(db, org, observation);
  for (const photo of rows) {
    const temporary = await db.storage
      .from(TEMP_PHOTO_BUCKET)
      .download(photo.storage_path);
    if (temporary.error || !temporary.data)
      throw new Error(
        "Falta una fotografía temporal. Reintenta la carga antes de publicar.",
      );
    const file = new File([temporary.data], "foto.jpg", {
      type: temporary.data.type,
    });
    const normalized = await normalizePhoto(file);
    const destination = db.storage.from(PHOTO_BUCKET);
    const stored = await destination.upload(photo.storage_path, normalized, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (stored.error) {
      if (String(stored.error.statusCode) !== "409")
        throw new Error(
          "No se pudo guardar la fotografía validada. Reintenta el registro.",
        );
      // Recuperación de una respuesta perdida: nunca aceptar una colisión distinta.
      const existing = await destination.download(photo.storage_path);
      if (
        existing.error ||
        !existing.data ||
        !Buffer.from(await existing.data.arrayBuffer()).equals(normalized)
      )
        throw new Error(
          "La fotografía guardada no coincide. Descarta este intento y vuelve a adjuntarla.",
        );
    }
    const metadata = await db
      .from("project_photos")
      .update({ byte_size: normalized.length })
      .eq("organization_id", org)
      .eq("observation_id", observation)
      .eq("id", photo.id)
      .select("id")
      .single();
    if (metadata.error || !metadata.data)
      throw new Error(
        "No se pudo confirmar el tamaño de la fotografía. Reintenta el registro.",
      );
  }
  const published = await db.rpc("publish_project_observation", {
    org,
    observation,
  });
  if (published.error)
    throw new Error(
      "No se confirmó la publicación. Reintenta Guardar para comprobar el resultado sin duplicar la observación.",
    );
  return cleanupTemporaryPhotos(db, rows);
}

export async function cleanupTemporaryPhotos(
  db: SupabaseClient,
  rows: Photo[],
) {
  if (!rows.length) return true;
  const result = await db.storage
    .from(TEMP_PHOTO_BUCKET)
    .remove(rows.map((p) => p.storage_path));
  return !result.error;
}

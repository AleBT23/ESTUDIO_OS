import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMP_PHOTO_BUCKET, type PreparedObservation } from "./photo-contract";

// Los bytes van directamente a Storage con la sesión del usuario y RLS.
// Un 409 solo permite reanudar ESTA ruta inmutable; el servidor valida su contenido.
export async function uploadPreparedPhotos(
  db: SupabaseClient,
  plan: PreparedObservation,
  files: File[],
  progress: (message: string) => void = () => {},
) {
  if (files.length !== plan.photos.length)
    throw new Error(
      "Las fotografías cambiaron. Descarta el intento y vuelve a prepararlo.",
    );
  for (const [index, target] of plan.photos.entries()) {
    const file = files[index];
    if (file.type !== "image/jpeg" || file.size !== target.size)
      throw new Error("La fotografía no coincide con la carga preparada.");
    progress(`Subiendo fotografía ${index + 1} de ${files.length}…`);
    const { error } = await db.storage
      .from(TEMP_PHOTO_BUCKET)
      .upload(target.path, file, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (error && String(error.statusCode) !== "409")
      throw new Error(
        "No se pudo subir una fotografía. Conservamos el intento; vuelve a pulsar Guardar para reintentarlo.",
      );
  }
}

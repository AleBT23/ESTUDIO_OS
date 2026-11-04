import { z } from "zod";
export function referencedImage(line: string) {
  const ref = /^\[\[imagen:([^\]]+)\]\]$/i.exec(line.trim());
  if (!ref) return null;
  if (!z.uuid().safeParse(ref[1]).success)
    throw Error("Imagen inválida. Selecciona una versión de la biblioteca.");
  return ref[1].toLowerCase();
}
export function documentImageIds(body: string) {
  const references = body
    .split(/\r?\n/)
    .map(referencedImage)
    .filter((id): id is string => id !== null);
  if (references.length > 12)
    throw Error("El documento admite hasta 12 imágenes de biblioteca.");
  return [...new Set(references)];
}

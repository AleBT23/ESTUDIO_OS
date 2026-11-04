import { z } from "zod";
export function referencedImage(line: string) {
  const ref = /^\[\[imagen:([^\]]+)\]\]$/i.exec(line.trim());
  if (!ref) return null;
  if (!z.uuid().safeParse(ref[1]).success)
    throw Error("Imagen inválida. Selecciona una versión de la biblioteca.");
  return ref[1].toLowerCase();
}
export function splitLetterhead(body: string) {
  const tag = /^\[\[membrete:([^\]\r\n]+)\]\](?:\r?\n|$)/i.exec(body);
  return tag
    ? { id: tag[1].toLowerCase(), content: body.slice(tag[0].length) }
    : { id: "", content: body };
}
export function documentImageIds(body: string) {
  const { id, content } = splitLetterhead(body);
  if (
    (id && !z.uuid().safeParse(id).success) ||
    /^\s*\[\[membrete:/im.test(content)
  )
    throw Error(
      "Imagen de membrete inválida. Elige una sola revisión en la primera línea.",
    );
  if (id && !content.trim())
    throw Error("Agrega contenido además del membrete.");
  const references = content
    .split(/\r?\n/)
    .map(referencedImage)
    .filter((id): id is string => id !== null);
  if (references.length > 12)
    throw Error("El documento admite hasta 12 imágenes de biblioteca.");
  return [...new Set(id ? [id, ...references] : references)];
}

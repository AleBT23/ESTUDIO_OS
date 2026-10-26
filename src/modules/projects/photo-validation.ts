import sharp from "sharp";
export async function normalizePhoto(file: File): Promise<Buffer> {
  if (file.type !== "image/jpeg" || !file.size || file.size > 2 * 1024 * 1024)
    throw new Error("La fotografía debe ser JPEG y ocupar como máximo 2 MB.");
  const input = Buffer.from(await file.arrayBuffer());
  const image = sharp(input, { limitInputPixels: 16777216, failOn: "error" });
  const info = await image.metadata();
  if (info.format !== "jpeg")
    throw new Error("El contenido no es una fotografía JPEG válida.");
  const output = await image
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82 })
    .toBuffer();
  if (output.length > 2097152)
    throw new Error("La fotografía supera el tamaño permitido.");
  return output;
}

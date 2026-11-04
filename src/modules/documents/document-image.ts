import sharp from "sharp";
export async function normalizeDocumentImage(bytes: Buffer) {
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (bytes.length > 2097152 || (!png && !jpeg))
    throw Error("Imagen inválida. Usa un PNG o JPEG de hasta 2 MiB.");
  return sharp(bytes, { limitInputPixels: 16000000, failOn: "error" })
    .rotate()
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 87 })
    .toBuffer();
}

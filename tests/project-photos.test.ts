import { it, expect } from "vitest";
import sharp from "sharp";
import { normalizePhoto } from "@/modules/projects/photo-validation";
it("normaliza fotos reales JPEG, limita dimensiones y retira metadatos", async () => {
  const bytes = await sharp({
    create: { width: 2100, height: 1200, channels: 3, background: "#435e46" },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();
  const file = new File([new Uint8Array(bytes)], "foto.jpg", {
    type: "image/jpeg",
  });
  const normalized = await normalizePhoto(file);
  const meta = await sharp(normalized).metadata();
  expect(meta.format).toBe("jpeg");
  expect(meta.width).toBeLessThanOrEqual(1600);
  expect(meta.height).toBeLessThanOrEqual(1600);
  expect(meta.exif).toBeUndefined();
  expect(normalized.length).toBeLessThanOrEqual(2097152);
});
it("rechaza fotos falsas, tipos activos y archivos grandes antes de subir", async () => {
  await expect(
    normalizePhoto(new File(["<svg/>"], "foto.svg", { type: "image/svg+xml" })),
  ).rejects.toThrow();
  await expect(
    normalizePhoto(
      new File(["No es una imagen"], "foto.jpg", { type: "image/jpeg" }),
    ),
  ).rejects.toThrow();
  await expect(
    normalizePhoto(
      new File([new Uint8Array(2097153)], "grande.jpg", { type: "image/jpeg" }),
    ),
  ).rejects.toThrow();
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await expect(
    normalizePhoto(
      new File([new Uint8Array(png)], "engano.jpg", { type: "image/jpeg" }),
    ),
  ).rejects.toThrow();
});

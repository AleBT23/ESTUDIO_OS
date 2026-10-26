import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { uploadPreparedPhotos } from "@/modules/projects/photo-upload";
import { publishPreparedPhotos } from "@/modules/projects/photo-publish";
import {
  photoDescriptorsSchema,
  PHOTO_BUCKET,
  TEMP_PHOTO_BUCKET,
} from "@/modules/projects/photo-contract";

const path = "org/observation/photo.jpg";
async function jpeg() {
  const bytes = await sharp({
    create: {
      width: 2100,
      height: 900,
      channels: 3,
      background: "#435e46",
    },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();
  return new File([new Uint8Array(bytes)], "visita.jpg", {
    type: "image/jpeg",
  });
}
function backend(paths = [path]) {
  const objects = new Map<string, Blob>();
  const rows = paths.map((storage_path, index) => ({
    id: String(index),
    storage_path,
    byte_size: 100,
  }));
  let published = false;
  let failUpload = "";
  let failCleanup = false;
  let publishResponseLost = false;
  const uploads: { bucket: string; path: string; upsert: boolean }[] = [];
  const rpc = vi.fn(async () => {
    if (rows.some((row) => !objects.has(PHOTO_BUCKET + "/" + row.storage_path)))
      return { error: { message: "Falta archivo definitivo" } };
    published = true;
    if (publishResponseLost) {
      publishResponseLost = false;
      return { error: { message: "Respuesta perdida" } };
    }
    return { error: null };
  });
  const db = {
    storage: {
      from: (bucket: string) => ({
        upload: async (
          key: string,
          bytes: Blob | Uint8Array,
          options: { upsert: boolean; contentType: string },
        ) => {
          uploads.push({ bucket, path: key, upsert: options.upsert });
          if (bucket === failUpload) {
            failUpload = "";
            return { error: { statusCode: "503" } };
          }
          const full = bucket + "/" + key;
          if (objects.has(full)) return { error: { statusCode: "409" } };
          objects.set(
            full,
            bytes instanceof Blob
              ? bytes
              : new Blob([new Uint8Array(bytes)], {
                  type: options.contentType,
                }),
          );
          return { error: null };
        },
        download: async (key: string) => ({
          data: objects.get(bucket + "/" + key) || null,
          error: objects.has(bucket + "/" + key) ? null : { statusCode: "404" },
        }),
        remove: async (keys: string[]) => {
          if (failCleanup) return { error: { statusCode: "503" } };
          keys.forEach((key) => objects.delete(bucket + "/" + key));
          return { error: null };
        },
      }),
    },
    from: () => {
      let patch: { byte_size: number } | undefined;
      let selectedId = "";
      const query = {
        select: () => query,
        eq: (name: string, value: string) => {
          if (name === "id") selectedId = value;
          return query;
        },
        order: async () => ({ data: rows, error: null }),
        update: (value: { byte_size: number }) => {
          patch = value;
          return query;
        },
        single: async () => {
          const row = rows.find((item) => item.id === selectedId);
          if (row && patch) row.byte_size = patch.byte_size;
          return { data: row, error: row ? null : {} };
        },
      };
      return query;
    },
    rpc,
  } as unknown as SupabaseClient;
  return {
    db,
    objects,
    rows,
    uploads,
    rpc,
    published: () => published,
    interruptUpload: (bucket: string) => {
      failUpload = bucket;
    },
    interruptPublication: () => {
      publishResponseLost = true;
    },
    interruptCleanup: () => {
      failCleanup = true;
    },
  };
}
beforeEach(() => vi.clearAllMocks());

it("cinco JPEG de 2 MiB válidos como metadatos no crean una solicitud de 10 MiB a Next", () => {
  const descriptors = Array.from({ length: 5 }, () => ({
    type: "image/jpeg",
    size: 2097152,
  }));
  expect(photoDescriptorsSchema.safeParse(descriptors).success).toBe(true);
  expect(
    new TextEncoder().encode(JSON.stringify(descriptors)).length,
  ).toBeLessThan(1000);
  expect(
    photoDescriptorsSchema.safeParse([...descriptors, descriptors[0]]).success,
  ).toBe(false);
  expect(
    photoDescriptorsSchema.safeParse([{ type: "image/svg+xml", size: 50 }])
      .success,
  ).toBe(false);
  expect(
    photoDescriptorsSchema.safeParse([{ type: "image/jpeg", size: 2097153 }])
      .success,
  ).toBe(false);
});

it("sube cinco archivos directamente al bucket temporal con sesión y sin upsert", async () => {
  const file = await jpeg();
  const paths = Array.from({ length: 5 }, (_, i) =>
    path.replace("photo", String(i)),
  );
  const b = backend(paths);
  const progress = vi.fn();
  await uploadPreparedPhotos(
    b.db,
    {
      observation: "observation",
      photos: paths.map((path) => ({ path, size: file.size })),
    },
    paths.map(() => file),
    progress,
  );
  expect(b.uploads).toHaveLength(5);
  expect(
    b.uploads.every(
      (call) => call.bucket === TEMP_PHOTO_BUCKET && !call.upsert,
    ),
  ).toBe(true);
  expect(progress).toHaveBeenCalledTimes(5);
  expect(b.rpc).not.toHaveBeenCalled();
});

it("el servidor decodifica, limita dimensiones, retira EXIF y registra el tamaño real", async () => {
  const b = backend();
  b.objects.set(TEMP_PHOTO_BUCKET + "/" + path, await jpeg());
  expect(await publishPreparedPhotos(b.db, "org", "observation")).toBe(true);
  const stored = b.objects.get(PHOTO_BUCKET + "/" + path)!;
  const metadata = await sharp(
    Buffer.from(await stored.arrayBuffer()),
  ).metadata();
  expect(metadata.format).toBe("jpeg");
  expect(metadata.width).toBeLessThanOrEqual(1600);
  expect(metadata.exif).toBeUndefined();
  expect(b.rows[0].byte_size).toBe(stored.size);
  expect(b.published()).toBe(true);
  expect(b.objects.has(TEMP_PHOTO_BUCKET + "/" + path)).toBe(false);
});

it("contenido falso o ausente no llega al bucket definitivo ni se publica", async () => {
  const b = backend();
  await expect(
    publishPreparedPhotos(b.db, "org", "observation"),
  ).rejects.toThrow("Falta");
  b.objects.set(
    TEMP_PHOTO_BUCKET + "/" + path,
    new Blob(["<script>alert(1)</script>"], { type: "image/jpeg" }),
  );
  await expect(
    publishPreparedPhotos(b.db, "org", "observation"),
  ).rejects.toThrow();
  expect(b.rpc).not.toHaveBeenCalled();
  expect(b.objects.has(PHOTO_BUCKET + "/" + path)).toBe(false);
});

it("una carga interrumpida y un 409 se reintentan sin reemplazar el temporal", async () => {
  const b = backend(),
    file = await jpeg();
  const plan = {
    observation: "observation",
    photos: [{ path, size: file.size }],
  };
  b.interruptUpload(TEMP_PHOTO_BUCKET);
  await expect(uploadPreparedPhotos(b.db, plan, [file])).rejects.toThrow(
    "Conservamos",
  );
  await uploadPreparedPhotos(b.db, plan, [file]);
  await uploadPreparedPhotos(b.db, plan, [file]);
  expect(b.objects.get(TEMP_PHOTO_BUCKET + "/" + path)).toBe(file);
  await expect(uploadPreparedPhotos(b.db, plan, [])).rejects.toThrow(
    "cambiaron",
  );
});

it("una respuesta perdida de publicación se reintenta sin sobrescribir el definitivo", async () => {
  const b = backend();
  b.objects.set(TEMP_PHOTO_BUCKET + "/" + path, await jpeg());
  b.interruptPublication();
  await expect(
    publishPreparedPhotos(b.db, "org", "observation"),
  ).rejects.toThrow("sin duplicar");
  const first = b.objects.get(PHOTO_BUCKET + "/" + path);
  await publishPreparedPhotos(b.db, "org", "observation");
  expect(b.objects.get(PHOTO_BUCKET + "/" + path)).toBe(first);
  expect(b.uploads.every((u) => !u.upsert)).toBe(true);
});

it("una colisión con bytes diferentes bloquea publicación sin reemplazar archivos", async () => {
  const b = backend();
  b.objects.set(TEMP_PHOTO_BUCKET + "/" + path, await jpeg());
  const other = new Blob(["contenido distinto"], { type: "image/jpeg" });
  b.objects.set(PHOTO_BUCKET + "/" + path, other);
  await expect(
    publishPreparedPhotos(b.db, "org", "observation"),
  ).rejects.toThrow("no coincide");
  expect(b.objects.get(PHOTO_BUCKET + "/" + path)).toBe(other);
  expect(b.rpc).not.toHaveBeenCalled();
});

it("conserva el temporal si falla la copia definitiva y permite reanudar", async () => {
  const b = backend();
  b.objects.set(TEMP_PHOTO_BUCKET + "/" + path, await jpeg());
  b.interruptUpload(PHOTO_BUCKET);
  await expect(
    publishPreparedPhotos(b.db, "org", "observation"),
  ).rejects.toThrow("validada");
  expect(b.objects.has(TEMP_PHOTO_BUCKET + "/" + path)).toBe(true);
  expect(b.published()).toBe(false);
  await publishPreparedPhotos(b.db, "org", "observation");
  expect(b.published()).toBe(true);
});

it("sin fotos publica texto; una limpieza fallida no revierte una publicación confirmada", async () => {
  const empty = backend([]);
  await expect(
    publishPreparedPhotos(empty.db, "org", "observation"),
  ).resolves.toBe(true);
  expect(empty.uploads).toHaveLength(0);
  const b = backend();
  b.objects.set(TEMP_PHOTO_BUCKET + "/" + path, await jpeg());
  b.interruptCleanup();
  await expect(publishPreparedPhotos(b.db, "org", "observation")).resolves.toBe(
    false,
  );
  expect(b.published()).toBe(true);
});

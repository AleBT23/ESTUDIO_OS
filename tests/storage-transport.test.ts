import { expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { uploadPreparedPhotos } from "@/modules/projects/photo-upload";
it("SDK real envía cinco fotos de 2 MiB directamente a Storage con JWT del usuario, sin tocar Next", async () => {
  const requests: {
    url: string;
    auth: string | null;
    size: number;
    upsert: string | null;
  }[] = [];
  const db = createClient(
    "https://storage.example.invalid",
    "public-test-key",
    {
      accessToken: async () => "user-test-token",
      global: {
        fetch: async (input, init) => {
          const request = new Request(input, init);
          const form = await request.formData();
          const file = [...form.values()].find(
            (value) => value instanceof Blob,
          ) as Blob;
          requests.push({
            url: request.url,
            auth: request.headers.get("authorization"),
            size: file.size,
            upsert: request.headers.get("x-upsert"),
          });
          return new Response(JSON.stringify({ Key: "temporal", Id: "test" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    },
  );
  const file = new File([new Uint8Array(2097152)], "synthetic.jpg", {
    type: "image/jpeg",
  });
  await uploadPreparedPhotos(
    db,
    {
      observation: "observation",
      photos: Array.from({ length: 5 }, (_, i) => ({
        path: `org/observation/${i}.jpg`,
        size: file.size,
      })),
    },
    Array.from({ length: 5 }, () => file),
  );
  expect(requests).toHaveLength(5);
  expect(
    requests.every((r) =>
      r.url.startsWith(
        "https://storage.example.invalid/storage/v1/object/project-photo-uploads/",
      ),
    ),
  ).toBe(true);
  expect(
    requests.every(
      (r) =>
        r.auth === "Bearer user-test-token" &&
        r.size === 2097152 &&
        r.upsert === "false",
    ),
  ).toBe(true);
  // La red se intercepta solo en este test; no se conectó a Supabase real.
});

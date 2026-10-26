import { z } from "zod";
export const conceptSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe un nombre de al menos dos caracteres.")
    .max(160),
  body: z
    .string()
    .trim()
    .min(1, "Escribe la descripción del concepto.")
    .max(10000),
});
export type Concept = z.infer<typeof conceptSchema> & {
  id: string;
  version: number;
  deleted_at: string | null;
};
export function insertConcept(description: string, body: string) {
  const result = [description.trim(), body.trim()].filter(Boolean).join("\n\n");
  if (result.length > 10000)
    throw new Error(
      "El texto combinado supera 10,000 caracteres. Acorta la descripción antes de insertar el concepto.",
    );
  return result;
}

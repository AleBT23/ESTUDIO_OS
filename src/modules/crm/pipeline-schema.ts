import { z } from "zod";
export const stages = {
  new: "Nuevo",
  contact: "En contacto",
  proposal: "Propuesta",
  negotiation: "Negociación",
  won: "Ganado",
  lost: "Perdido",
};
export const opportunitySchema = z.object({
  name: z.string().trim().min(2).max(160),
  client_id: z.uuid(),
  business_line_id: z.uuid(),
  stage: z.enum(["new", "contact", "proposal", "negotiation", "won", "lost"]),
  notes: z.string().trim().max(10000),
  next_follow_up: z
    .union([z.literal(""), z.iso.date()])
    .transform((v) => v || null),
});
export type Opportunity = z.output<typeof opportunitySchema> & {
  id: string;
  version: number;
  deleted_at: string | null;
};

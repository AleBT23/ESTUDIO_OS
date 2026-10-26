import { z } from "zod";

export const photoDescriptorSchema = z
  .object({
    type: z.literal("image/jpeg"),
    size: z.number().int().min(1).max(2097152),
  })
  .strict();
export const photoDescriptorsSchema = z.array(photoDescriptorSchema).max(5);
export type PhotoDescriptor = z.infer<typeof photoDescriptorSchema>;
export type PreparedObservation = {
  observation: string;
  photos: { path: string; size: number }[];
};
export type ObservationResult = {
  error?: string;
  success?: string;
  nextRequestId?: string;
  published?: boolean;
};
export const TEMP_PHOTO_BUCKET = "project-photo-uploads";
export const PHOTO_BUCKET = "project-photos";

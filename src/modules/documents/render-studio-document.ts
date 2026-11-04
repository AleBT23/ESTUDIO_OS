import "server-only";
import { requireContext } from "@/shared/auth/context";
import { StandaloneRenderer } from "./standalone-renderer";
import type { StandaloneSnapshot } from "./standalone-schema";
import { documentImageIds } from "./image-references";
import { loadLibraryImage } from "./library-images";
export async function renderStudioDocument(snapshot: StandaloneSnapshot) {
  const ids = documentImageIds(snapshot.body);
  const images = new Map<string, Buffer>();
  if (ids.length) {
    const ctx = await requireContext();
    for (const id of ids) images.set(id, await loadLibraryImage(ctx, id));
  }
  return new StandaloneRenderer().render(snapshot, images);
}

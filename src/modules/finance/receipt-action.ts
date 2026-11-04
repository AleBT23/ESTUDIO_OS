"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";
import { receiptInfo, receiptLimit } from "./receipt-file";
export async function attachReceipt(
  _prev: RecordState,
  data: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = z
    .object({ entry_id: z.uuid(), case_id: z.uuid() })
    .safeParse(Object.fromEntries(data));
  const file = data.get("receipt");
  if (
    !input.success ||
    !(file instanceof File) ||
    !file.size ||
    file.size > receiptLimit
  )
    return { error: "Selecciona un PDF, PNG o JPEG de hasta 2 MiB." };
  const bytes = Buffer.from(await file.arrayBuffer()),
    meta = receiptInfo(bytes);
  if (!meta) return { error: "Formato de comprobante no admitido." };
  const org = ctx.organization.id,
    { entry_id, case_id } = input.data;
  const entry = await ctx.db
    .from("finance_entries")
    .select("id")
    .eq("organization_id", org)
    .eq("case_id", case_id)
    .eq("id", entry_id)
    .maybeSingle();
  if (entry.error || !entry.data) return { error: "Movimiento no disponible." };
  const path = [org, entry_id, meta.sha256].join("/");
  const { error } = await ctx.db
    .from("finance_receipts")
    .insert({
      id: crypto.randomUUID(),
      organization_id: org,
      entry_id,
      filename: file.name.slice(0, 180).trim() || "Comprobante",
      ...meta,
    });
  if (error && error.code !== "23505")
    return { error: "No se pudo preparar el comprobante." };
  const bucket = ctx.db.storage.from("finance-receipts");
  const uploaded = await bucket.upload(path, bytes, {
    contentType: meta.mime,
    upsert: false,
  });
  if (uploaded.error) {
    const prior = await bucket.download(path);
    if (
      prior.error ||
      !prior.data ||
      receiptInfo(Buffer.from(await prior.data.arrayBuffer()))?.sha256 !==
        meta.sha256
    )
      return {
        error:
          "Carga incompleta. Vuelve a seleccionar el mismo archivo para reintentar.",
      };
  }
  revalidatePath("/administracion/comprobantes/" + entry_id);
  return {
    success: "Comprobante disponible para descarga.",
    nextId: crypto.randomUUID(),
  };
}

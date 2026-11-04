"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { toCents } from "@/shared/money";
import type { OperationState } from "./operations-actions";
const invoice = z.object({
  id: z.uuid(),
  case_id: z.uuid(),
  reference: z.string().trim().min(1).max(120),
  issued_on: z.iso.date(),
  amount_cents: z
    .string()
    .regex(/^\d{1,12}(\.\d{1,2})?$/)
    .transform(toCents)
    .refine((v) => v > 0),
});
export async function saveInvoice(
  _state: OperationState,
  form: FormData,
): Promise<OperationState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const parsed = invoice.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: "Revisa el folio, la fecha de emisión y el importe de la factura.",
    };
  const { error } = await ctx.db
    .from("case_invoices")
    .insert({ ...parsed.data, organization_id: ctx.organization.id });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "Esta factura ya está registrada."
          : "No se pudo registrar la factura.",
    };
  revalidatePath("/administracion/operaciones/" + parsed.data.case_id);
  return { success: "Factura registrada.", nextId: crypto.randomUUID() };
}

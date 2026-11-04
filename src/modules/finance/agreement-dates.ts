"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import type { RecordState } from "@/shared/ui/record-form";

const date = z
  .union([z.iso.date(), z.literal("")])
  .optional()
  .transform((v) => v || null);
const input = z.object({
  id: z.uuid(),
  collect_on: date,
  pay_on: date,
  original_collect_on: date,
  original_pay_on: date,
});
export async function saveAgreementDates(
  _prev: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const parsed = input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Revisa las fechas del acuerdo." };
  const { id, collect_on, pay_on, original_collect_on, original_pay_on } =
    parsed.data;
  let query = ctx.db
    .from("finance_cases")
    .update({ collect_on, pay_on })
    .eq("organization_id", ctx.organization.id)
    .eq("id", id);
  query = original_collect_on
    ? query.eq("collect_on", original_collect_on)
    : query.is("collect_on", null);
  query = original_pay_on
    ? query.eq("pay_on", original_pay_on)
    : query.is("pay_on", null);
  const result = await query.select("id").maybeSingle();
  if (result.error || !result.data)
    return {
      error:
        "No se guardaron las fechas. Actualiza el acuerdo y revisa los vencimientos vigentes.",
    };
  revalidatePath("/agenda", "layout");
  revalidatePath("/administracion/operaciones/" + id);
  revalidatePath("/");
  return { success: "Fechas guardadas." };
}

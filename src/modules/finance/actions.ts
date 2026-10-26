"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";
import { moneyInput } from "@/modules/quotes/schema";
import { toCents } from "@/shared/money";
export async function recordPayment(
  _previous: FormState,
  form: FormData,
): Promise<FormState & { requestId?: string }> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Tu rol no permite registrar cobros." };
  const input = z
    .object({
      schedule: z.uuid(),
      amount: moneyInput.refine((v) => Number(v) > 0),
      date: z.iso.date(),
      reference: z.string().trim().max(200),
      request_id: z.uuid(),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error:
        "Selecciona una obligación, un importe mayor a cero y la fecha del pago.",
    };
  const { error } = await ctx.db.rpc("record_payment", {
    org: ctx.organization.id,
    schedule: input.data.schedule,
    amount: toCents(input.data.amount),
    payment_date: input.data.date,
    payment_reference: input.data.reference,
    request_id: input.data.request_id,
  });
  if (error)
    return {
      error:
        "No se registró el cobro. Revisa que no supere el saldo y que la fecha no sea futura. Si ya lo registraste, recarga la página.",
    };
  revalidatePath("/administracion");
  revalidatePath("/proyectos", "layout");
  return {
    success: "Pago efectivo registrado. El saldo del plan se actualizó.",
    requestId: crypto.randomUUID(),
  };
}
export async function reversePayment(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      reason: z.string().trim().min(3).max(1000),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Explica el motivo del reverso (mínimo 3 caracteres)." };
  const { error } = await ctx.db.rpc("reverse_payment", {
    org: ctx.organization.id,
    payment: input.data.id,
    expected_version: input.data.version,
    reason: input.data.reason,
  });
  if (error)
    return {
      error: "No se pudo revertir. Recarga si el movimiento ya cambió.",
    };
  revalidatePath("/administracion");
  revalidatePath("/proyectos", "layout");
  return {
    success:
      "Pago revertido con trazabilidad. El movimiento original se conserva.",
  };
}

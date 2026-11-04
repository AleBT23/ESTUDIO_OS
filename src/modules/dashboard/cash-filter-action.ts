"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { cashFilter } from "./cash-filter";
import type { RecordState } from "@/shared/ui/record-form";
export async function setCashFilter(
  _: RecordState,
  form: FormData,
): Promise<RecordState> {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const values = cashFilter(Object.fromEntries(form), ctx.lines);
  if (!values)
    return { error: "Revisa el intervalo de fechas y la línea seleccionada." };
  const jar = await cookies(),
    key = "studio-flow-" + ctx.organization.id + "-" + ctx.user.id;
  if (Object.values(values).some(Boolean))
    jar.set(key, new URLSearchParams(values).toString(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  else jar.delete(key);
  revalidatePath("/");
  return { success: "Filtro actualizado." };
}

"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import type { FormState } from "@/shared/auth/actions";
import { toCents, calculateQuote } from "@/shared/money";
import { serviceSchema, quoteSchema } from "./schema";
export async function saveService(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Tu rol no permite modificar el catálogo." };
  const input = serviceSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: input.error.issues[0].message };
  const { price, estimatedCost, valid_until, ...fields } = input.data;
  const record = {
    ...fields,
    valid_until: valid_until || null,
    price_cents: toCents(price),
    estimated_cost_cents: toCents(estimatedCost),
  };
  const id = form.get("id");
  let target: string;
  if (id) {
    const version = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(form.get("version"));
    if (!z.uuid().safeParse(id).success || !version.success)
      return { error: "Referencia inválida." };
    const { data, error } = await ctx.db
      .from("services")
      .update(record)
      .eq("organization_id", ctx.organization.id)
      .eq("id", id)
      .eq("version", version.data)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error)
      return {
        error:
          error.code === "23505"
            ? "Esta clave ya existe en el catálogo."
            : "No se pudo guardar el servicio. Revisa la conexión y los campos.",
      };
    if (!data)
      return {
        error: "El servicio cambió. Copia tus cambios y vuelve a abrirlo.",
      };
    target = data.id;
  } else {
    const { data, error } = await ctx.db
      .from("services")
      .insert({ ...record, organization_id: ctx.organization.id })
      .select("id")
      .single();
    if (error)
      return {
        error:
          error.code === "23505"
            ? "Esta clave ya existe en el catálogo."
            : "No se pudo guardar el servicio.",
      };
    target = data.id;
  }
  revalidatePath("/comercial/catalogo");
  redirect(`/comercial/catalogo?service=${target}`);
}
export async function archiveService(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  const input = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().positive(),
      intent: z.enum(["archive", "restore"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Referencia inválida." };
  const { data, error } = await ctx.db
    .from("services")
    .update({
      deleted_at:
        input.data.intent === "archive" ? new Date().toISOString() : null,
    })
    .eq("organization_id", ctx.organization.id)
    .eq("id", input.data.id)
    .eq("version", input.data.version)
    .select("id")
    .maybeSingle();
  if (error) return { error: "No se pudo actualizar el servicio." };
  if (!data)
    return { error: "El servicio cambió. Recarga antes de continuar." };
  revalidatePath("/comercial/catalogo");
  return {
    success:
      "Servicio actualizado. Las propuestas existentes conservan sus conceptos y precios.",
  };
}
export async function savePreset(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("items")));
  } catch {
    return { error: "No se pudo leer la selección de servicios." };
  }
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(160),
      notes: z.string().max(10000),
      items: z
        .array(
          z.object({
            service_id: z.uuid(),
            quantity: z
              .string()
              .regex(/^\d{1,12}(\.\d{1,4})?$/)
              .refine((q) => Number(q) > 0),
          }),
        )
        .min(1)
        .max(100),
      id: z.union([z.literal(""), z.uuid()]),
      version: z.coerce.number().int().nonnegative(),
    })
    .safeParse({ ...Object.fromEntries(form), items: raw });
  if (!parsed.success)
    return {
      error:
        "Escribe un nombre y selecciona de 1 a 100 servicios con cantidades mayores a cero.",
    };
  const input = parsed.data;
  const { data, error } = await ctx.db.rpc("save_preset", {
    org: ctx.organization.id,
    preset: input.id || null,
    expected_version: input.version,
    preset_name: input.name,
    preset_notes: input.notes,
    items: input.items,
  });
  if (error)
    return {
      error:
        "No se guardó el preset. Revisa servicios disponibles o recarga si alguien lo editó.",
    };
  revalidatePath("/comercial/presets");
  redirect(`/comercial/presets?selected=${data}`);
}
export async function saveQuote(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return { error: "Permisos insuficientes." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload")));
  } catch {
    return {
      error:
        "No se pudo leer la propuesta. Copia tus cambios antes de recargar.",
    };
  }
  const input = quoteSchema.safeParse(raw);
  if (!input.success) return { error: input.error.issues[0].message };
  const identity = z
    .object({
      id: z.union([z.literal(""), z.uuid()]),
      version: z.coerce.number().int().nonnegative(),
    })
    .safeParse(Object.fromEntries(form));
  if (!identity.success) return { error: "Referencia de cotización inválida." };
  try {
    calculateQuote(
      input.data.items,
      input.data.header.vat_rate,
      input.data.header.apply_vat,
    );
  } catch {
    return {
      error: "Revisa los importes: la propuesta supera el rango permitido.",
    };
  }
  const { externalCost, ...header } = input.data.header;
  const { data, error } = await ctx.db.rpc("save_quote_draft", {
    org: ctx.organization.id,
    quote: identity.data.id || null,
    expected_version: identity.data.version,
    header: { ...header, external_cost_cents: toCents(externalCost) },
    items: input.data.items.map(({ unitPrice, discount, ...item }) => ({
      ...item,
      unit_price_cents: toCents(unitPrice),
      discount_rate: discount,
    })),
  });
  if (error)
    return {
      error:
        "No se guardó la propuesta. Revisa cliente, partidas y conexión. Si otra persona la modificó, copia tus cambios y vuelve a abrirla.",
    };
  revalidatePath("/comercial/cotizaciones");
  redirect(`/comercial/cotizaciones/${data}`);
}

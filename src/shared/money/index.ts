import Decimal from "decimal.js";

// Strings decimales de entrada; centavos enteros de salida. HALF_UP por partida,
// descuento por partida, e impuesto sobre la suma neta. Sin floats financieros.
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type QuoteLine = {
  quantity: string;
  unitPrice: string;
  discount: string;
  unit: string;
};
function positive(value: string, max?: number) {
  if (!/^\d{1,12}(\.\d{1,4})?$/.test(value))
    throw new Error("Importe o cantidad inválida");
  const number = new D(value);
  if (max !== undefined && number.gt(max))
    throw new Error("Porcentaje fuera de rango");
  return number;
}
function cents(value: Decimal) {
  const rounded = value.mul(100).toDecimalPlaces(0);
  if (rounded.gt(Number.MAX_SAFE_INTEGER))
    throw new Error("Importe fuera de rango");
  return rounded.toNumber();
}
export function calculateQuote(
  items: QuoteLine[],
  vatRate: string,
  applyVat: boolean,
) {
  const rate = positive(vatRate, 100);
  let subtotal = 0;
  let discount = 0;
  const lines = items.map((item) => {
    const base = positive(item.quantity)
      .mul(positive(item.unitPrice))
      .div(item.unit === "pct" ? 100 : 1);
    const baseCents = cents(base);
    const discountCents = cents(
      new D(baseCents).div(100).mul(positive(item.discount, 100)).div(100),
    );
    subtotal += baseCents;
    discount += discountCents;
    return {
      base: baseCents,
      discount: discountCents,
      net: baseCents - discountCents,
    };
  });
  if (!Number.isSafeInteger(subtotal))
    throw new Error("Importe fuera de rango");
  const net = subtotal - discount;
  const tax = applyVat
    ? new D(net).mul(rate).div(100).toDecimalPlaces(0).toNumber()
    : 0;
  if (!Number.isSafeInteger(net + tax))
    throw new Error("Importe fuera de rango");
  return { lines, subtotal, discount, net, tax, total: net + tax };
}
export function splitAdvance(total: number, percentage: string) {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new Error("Total inválido");
  const advance = new D(total)
    .mul(positive(percentage, 100))
    .div(100)
    .toDecimalPlaces(0)
    .toNumber();
  return { advance, balance: total - advance, collected: 0 };
}
export function formatMoney(cents: number, currency = "MXN") {
  if (!Number.isSafeInteger(cents)) throw new Error("Importe fuera de rango");
  // No dividir en coma flotante: en importes cercanos al máximo seguro,
  // cents/100 puede perder un centavo incluso antes del formateo.
  const absolute = BigInt(Math.abs(cents));
  const whole = new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 0,
  }).format(absolute / 100n);
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .formatToParts(cents < 0 ? -0 : 0)
    .map((part) =>
      part.type === "integer"
        ? whole
        : part.type === "fraction"
          ? fraction
          : part.value,
    )
    .join("");
}
export function toCents(value: string) {
  return cents(positive(value));
}
export function fromCents(value: number) {
  if (!Number.isSafeInteger(value)) throw new Error("Importe fuera de rango");
  return new D(value).div(100).toFixed(2);
}
export function estimateFees(
  netRevenueCents: number,
  externalCost: string,
  estimatedHours: string,
) {
  if (!Number.isSafeInteger(netRevenueCents) || netRevenueCents < 0)
    throw new Error("Ingreso inválido");
  const externalCostCents = toCents(externalCost);
  const hours = positive(estimatedHours);
  const profitCents = netRevenueCents - externalCostCents;
  const marginPercent =
    netRevenueCents === 0
      ? null
      : new D(profitCents).div(netRevenueCents).mul(100).toFixed(2);
  const hourly = hours.isZero()
    ? null
    : new D(netRevenueCents).div(hours).toDecimalPlaces(0);
  if (hourly?.gt(Number.MAX_SAFE_INTEGER))
    throw new Error("La tarifa por hora supera el rango permitido.");
  return {
    externalCostCents,
    profitCents,
    marginPercent,
    effectiveHourlyCents: hourly?.toNumber() ?? null,
  };
}

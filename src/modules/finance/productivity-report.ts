import { z } from "zod";
const id = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((v) => v || null);
const day = z
  .union([z.iso.date(), z.literal("")])
  .optional()
  .transform((v) => v || null);
export const reportFilters = z
  .object({
    from_date: day,
    to_date: day,
    customer: id,
    project: id,
    work: id,
    package: id,
    line: id,
  })
  .refine((f) => !f.from_date || !f.to_date || f.from_date <= f.to_date);
export type ProductivityRow = {
  line_name: string;
  managed: boolean;
  received: string;
  paid: string;
  net: string;
  minutes: string;
  net_hourly: string | null;
};
export function reportCsv(rows: ProductivityRow[]) {
  const decimal = (value: string) => {
    const n = BigInt(value),
      a = n < 0n ? -n : n;
    return (
      (n < 0n ? "-" : "") +
      a / 100n +
      "." +
      (a % 100n).toString().padStart(2, "0")
    );
  };
  const label = (s: string) =>
    '"' + (/^[\s]*[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
  return (
    "\uFEFF" +
    [
      [
        "Línea",
        "Fondos",
        "Cobrado MXN",
        "Pagado MXN",
        "Flujo MXN",
        "Minutos",
        "Flujo por hora MXN",
      ].join(","),
      ...rows.map((r) =>
        [
          label(r.line_name),
          r.managed ? "Del cliente" : "Propios",
          decimal(r.received),
          decimal(r.paid),
          decimal(r.net),
          r.minutes,
          r.net_hourly === null ? "" : decimal(r.net_hourly),
        ].join(","),
      ),
    ].join("\r\n") +
    "\r\n"
  );
}

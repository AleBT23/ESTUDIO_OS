import { reportFilters } from "@/modules/finance/productivity-report";
export function cashFilter(
  raw: Record<string, unknown>,
  lines: { id: string }[],
) {
  const value = {
    from_date: raw.from_date ?? "",
    to_date: raw.to_date ?? "",
    line: raw.line ?? "",
  };
  const parsed = reportFilters.safeParse(value);
  if (
    !parsed.success ||
    (parsed.data.line && !lines.some((l) => l.id === parsed.data.line))
  )
    return null;
  return {
    from_date: parsed.data.from_date ?? "",
    to_date: parsed.data.to_date ?? "",
    line: parsed.data.line ?? "",
  };
}

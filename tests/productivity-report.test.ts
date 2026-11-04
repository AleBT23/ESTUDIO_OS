import { it, expect } from "vitest";
import {
  reportFilters,
  reportCsv,
  receivedPerHour,
} from "@/modules/finance/productivity-report";
it("valida el periodo y exporta centavos con etiquetas seguras para Excel", () => {
  expect(
    reportFilters.safeParse({ from_date: "2026-11-03", to_date: "2026-11-01" })
      .success,
  ).toBe(false);
  expect(reportFilters.safeParse({ project: "incorrecto" }).success).toBe(
    false,
  );
  const csv = reportCsv([
    {
      line_name: "=HYPERLINK(1)",
      managed: false,
      received: "9007199254740993",
      paid: "0",
      net: "-1",
      minutes: "0",
      net_hourly: null,
    },
  ]);
  expect(csv).toContain(
    '"\'=HYPERLINK(1)",Propios,90071992547409.93,0.00,-0.01,0,',
  );
});

it("compara cobrado y flujo por hora y omite tasas sin horas o con fondos administrados", () => {
  const row = {
    line_name: "Arquitectura",
    managed: false,
    received: "1001",
    paid: "201",
    net: "800",
    minutes: "120",
    net_hourly: "400",
  };
  expect(receivedPerHour(row)).toBe(501n);
  expect(reportCsv([row])).toContain("10.01,2.01,8.00,120,4.00,5.01");
  expect(receivedPerHour({ ...row, minutes: "0" })).toBeNull();
  expect(receivedPerHour({ ...row, managed: true })).toBeNull();
});

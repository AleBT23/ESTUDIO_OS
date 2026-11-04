import {it,expect} from "vitest";
import {reportFilters,reportCsv} from "@/modules/finance/productivity-report";
it("valida el periodo y exporta centavos con etiquetas seguras para Excel",()=>{
 expect(reportFilters.safeParse({from_date:"2026-11-03",to_date:"2026-11-01"}).success).toBe(false);
 expect(reportFilters.safeParse({project:"incorrecto"}).success).toBe(false);
 const csv=reportCsv([{line_name:"=HYPERLINK(1)",managed:false,received:"9007199254740993",paid:"0",net:"-1",minutes:"0",net_hourly:null}]);
 expect(csv).toContain('"\'=HYPERLINK(1)",Propios,90071992547409.93,0.00,-0.01,0,');
});

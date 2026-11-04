import {expect,it} from "vitest";
import {expenseCsv} from "@/modules/finance/expense-categories";
it("exporta el total de egresos en MXN sin perder centavos ni ocultar pagos históricos",()=>{
 expect(expenseCsv([{area:"construction",managed:true,category:null,movements:15,paid:"9007199254740993"}])).toContain("Obra,Del cliente,Sin clasificar,15,90071992547409.93\r\n");
});

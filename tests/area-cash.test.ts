import {expect,it} from "vitest";
import {areaCashCsv} from "@/modules/finance/area-cash";
it("separa dinero administrado en el CSV y conserva centavos grandes",()=>{
 const csv=areaCashCsv([{area:"construction",managed:true,received:"9007199254740999",paid:"1",net:"9007199254740998"},{area:"service",managed:false,received:"100",paid:"25",net:"75"}]);
 expect(csv).toContain("Obra,Del cliente,90071992547409.99,0.01,90071992547409.98,\r\n");
 expect(csv).toMatch(/Servicio complementario,Propios,1\.00,0\.25,0\.75,75/);
});

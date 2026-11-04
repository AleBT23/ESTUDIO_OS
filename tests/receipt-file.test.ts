import {expect,it} from "vitest";
import {receiptInfo,receiptLimit} from "@/modules/finance/receipt-file";
it("limita el tamaño, detecta firmas y calcula la huella del contenido",()=>{
 const a=receiptInfo(Buffer.from("%PDF-ejemplo")),b=receiptInfo(Buffer.from("%PDF-diferente"));
 expect(a?.mime).toBe("application/pdf");expect(a?.sha256).not.toBe(b?.sha256);
 expect(receiptInfo(Buffer.from("<html>"))).toBeNull();
 expect(receiptInfo(Buffer.alloc(receiptLimit+1))).toBeNull();
 expect(receiptInfo(Buffer.from("ffd8ff","hex"))?.mime).toBe("image/jpeg");
 expect(receiptInfo(Buffer.from("89504e470d0a1a0a","hex"))?.mime).toBe("image/png");
});

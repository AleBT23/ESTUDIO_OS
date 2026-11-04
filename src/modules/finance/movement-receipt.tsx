import {
  Document,
  Page,
  Text,
  View,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import { formatMoney } from "@/shared/money";

Font.register({
  family: "ReceiptSans",
  src: path.join(process.cwd(), "assets/fonts/noto-sans-latin-400-normal.woff"),
});
export type Receipt = {
  id: string;
  paid_on: string;
  amount: string;
  direction: string;
  managed: boolean;
  reversed: boolean;
  reversal_reason: string | null;
  concept: string;
  project_name: string | null;
  client_name: string | null;
  work_name: string | null;
  provider: string | null;
  reference: string | null;
};
export function renderReceipt(studio: string, row: Receipt) {
  const title = row.direction === "in" ? "Recibo de cobro" : "Recibo de pago";
  const lines = [
    ["Fecha del movimiento", row.paid_on],
    ["Concepto", row.concept],
    [
      "Fondos",
      row.managed ? "Administrados del cliente" : "Propios del despacho",
    ],
    ["Cliente", row.client_name],
    ["Proyecto", row.project_name],
    ["Obra", row.work_name],
    ["Proveedor", row.provider],
    ["Referencia", row.reference],
    ["Motivo del reverso", row.reversal_reason],
    ["Identificador del movimiento", row.id],
  ];
  return renderToBuffer(
    <Document title={title} author={studio} language="es-MX">
      <Page
        size="LETTER"
        style={{
          fontFamily: "ReceiptSans",
          fontSize: 11,
          padding: 48,
          color: "#192c2a",
        }}
      >
        <Text style={{ fontSize: 12, marginBottom: 18 }}>{studio}</Text>
        <Text style={{ fontSize: 26 }}>{title}</Text>
        <Text
          style={{
            marginVertical: 8,
            color: row.reversed ? "#903b26" : "#346156",
          }}
        >
          {row.reversed ? "MOVIMIENTO REVERTIDO" : "MOVIMIENTO REGISTRADO"}
        </Text>
        <Text style={{ fontSize: 20, marginBottom: 18 }}>
          {formatMoney(BigInt(row.amount))} MXN
        </Text>
        {lines
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <View key={label} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 9, color: "#50645f" }}>{label}</Text>
              <Text>{value}</Text>
            </View>
          ))}
      </Page>
    </Document>,
  );
}

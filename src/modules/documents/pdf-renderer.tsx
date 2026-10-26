import {
  Document,
  Page,
  View,
  Text,
  Image as PdfImage,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "node:fs";
import {
  calculateQuote,
  formatMoney,
  fromCents,
  splitAdvance,
} from "@/shared/money";
import {
  quoteSnapshotSchema,
  type QuoteSnapshot,
  type DocumentRenderer,
  type DocumentOptions,
  sectionLabels,
} from "./schema";
const pt = (mm: number) => (mm * 72) / 25.4;
Font.register({
  family: "EstudioPoppins",
  fonts: [
    {
      src: path.join(process.cwd(), "assets/fonts/Poppins-Medium.ttf"),
      fontWeight: 500,
    },
    {
      src: path.join(process.cwd(), "assets/fonts/Poppins-Regular.ttf"),
      fontWeight: 400,
    },
    {
      src: path.join(process.cwd(), "assets/fonts/Poppins-SemiBold.ttf"),
      fontWeight: 600,
    },
  ],
});
const styles = StyleSheet.create({
  page: {
    fontFamily: "EstudioPoppins",
    fontSize: 11,
    color: "#182624",
    lineHeight: 1.5,
  },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 612,
    height: 792,
    objectFit: "contain",
  },
  eyebrow: {
    fontSize: 9,
    color: "#687768",
    letterSpacing: 1.3,
    marginBottom: 14,
  },
  title: { fontSize: 24, fontWeight: 600, lineHeight: 1.25, marginBottom: 18 },
  subtitle: { fontSize: 16, fontWeight: 500, marginBottom: 12 },
  text: { marginBottom: 12 },
  small: { fontSize: 9, color: "#64716b" },
  row: {
    flexDirection: "row",
    borderBottom: "1 solid #e3e8df",
    paddingVertical: 8,
  },
  tableHeader: {
    position: "absolute",
    flexDirection: "row",
    backgroundColor: "#435e46",
    color: "#ffffff",
    paddingVertical: 8,
    fontSize: 9,
  },
  tableTitle: {
    position: "absolute",
    fontWeight: 600,
    fontSize: 24,
    lineHeight: 1.25,
  },
  code: { width: "8%", fontSize: 9, paddingRight: 5 },
  desc: { width: "35%", paddingRight: 8 },
  unit: { width: "8%", fontSize: 9, paddingRight: 4 },
  qty: { width: "9%", textAlign: "right", paddingRight: 7 },
  price: { width: "20%", textAlign: "right", paddingRight: 7 },
  amount: { width: "20%", textAlign: "right" },
  totals: { marginTop: 18, marginLeft: "30%", paddingTop: 10 },
  totalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 6,
    fontSize: 11,
  },
  grand: {
    fontWeight: 600,
    fontSize: 16,
    borderTop: "1 solid #435e46",
    paddingTop: 10,
    marginTop: 5,
  },
  footer: {
    position: "absolute",
    fontSize: 9,
    color: "#64716b",
    textAlign: "right",
  },
  signature: {
    borderTop: "1 solid #182624",
    marginTop: 70,
    paddingTop: 8,
    width: "75%",
  },
});
// Medición con la misma fuente incrustada: limita cada continuación al área útil.
const measureFont = fontkit.create(
  readFileSync(path.join(process.cwd(), "assets/fonts/Poppins-Regular.ttf")),
);
function lines(text: string, width: number, size = 11): string[] {
  const measure = (value: string) =>
    (measureFont
      .layout(value)
      .positions.reduce((sum, p) => sum + p.xAdvance, 0) *
      size) /
    measureFont.unitsPerEm;
  const result: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && measure(line + " " + word) > width) {
        result.push(line);
        line = "";
      }
      for (const char of word) {
        if (measure(line + char) > width && line) {
          result.push(line);
          line = "";
        }
        line += char;
      }
      line += " ";
    }
    result.push(line.trimEnd());
  }
  return result.length ? result : [""];
}
function budgetLayout(s: QuoteSnapshot) {
  const width = 612 - pt(s.options.margins.left + s.options.margins.right);
  const client = lines("Cliente: " + s.client.name, width - 4, 9);
  const project = lines("Proyecto: " + s.quote.name, width - 4, 9);
  const metaHeight =
    (client.length + project.length) * 13.5 +
    (lines(`${s.folio} · ${s.organization.name}`, width - 4, 9).length - 1) *
      13.5;
  return { width, client, project, headerHeight: 64 + metaHeight + 20 + 38 };
}
function chunks(
  text: string,
  width: number,
  maxLines: number,
  continuationWidth: number,
) {
  const wrapped = lines(text, width);
  if (wrapped.length <= maxLines) return [wrapped.join("\n")];
  const lead = Math.min(6, maxLines);
  const rest = lines(wrapped.slice(lead).join(" "), continuationWidth);
  const result: string[] = [wrapped.slice(0, lead).join("\n")];
  const continuationLines = Math.max(1, Math.floor(maxLines / 2));
  for (let i = 0; i < rest.length; i += continuationLines)
    result.push(rest.slice(i, i + continuationLines).join("\n"));
  return result;
}
type BudgetRow = {
  index: number;
  part: number;
  description: string;
  height: number;
};
function paginateBudget(s: QuoteSnapshot) {
  const layout = budgetLayout(s);
  const capacity =
    792 -
    pt(s.options.margins.top + s.options.margins.bottom) -
    layout.headerHeight;
  const pages: {
    rows: BudgetRow[];
    used: number;
    summary: boolean;
    conditions: boolean;
  }[] = [{ rows: [], used: 0, summary: false, conditions: false }];
  s.items.forEach((item, index) => {
    const narrow = layout.width * 0.35 - 12;
    const nameHeight =
      lines(item.name + " (continuación)", narrow).length * 16.5;
    const maxLines = Math.max(
      1,
      Math.floor((capacity - nameHeight - 40) / 16.5),
    );
    chunks(
      item.description,
      narrow,
      maxLines,
      layout.width * 0.92 - 12,
    ).forEach((description, part) => {
      const width = layout.width * (part ? 0.92 : 0.35) - 12;
      const title = item.name + (part ? " (continuación)" : "");
      const descriptionHeight =
        lines(title, width).length * 16.5 +
        description.split("\n").length * 16.5 +
        (part === 0 && Number(item.discount_rate) > 0 ? 13.5 : 0);
      const codeHeight = part
        ? 0
        : lines(item.code || "-", layout.width * 0.08 - 5, 9).length * 13.5;
      const height = Math.max(descriptionHeight, codeHeight) + 18;
      if (height > capacity)
        throw new Error(
          "El contenido requiere más espacio; reduce los márgenes del documento.",
        );
      let page = pages[pages.length - 1];
      if (page.rows.length && page.used + height > capacity) {
        page = { rows: [], used: 0, summary: false, conditions: false };
        pages.push(page);
      }
      page.rows.push({ index, part, description, height });
      page.used += height;
    });
  });
  // Reserva conservadora para resumen, anticipo y vigencia con tipografía real.
  const summaryHeight =
    160 +
    lines(
      "Anticipo previsto 100%: $90,071,992,547,409.91. Saldo: $90,071,992,547,409.91.",
      layout.width * 0.7,
      9,
    ).length *
      13.5;
  let last = pages[pages.length - 1];
  if (last.used + summaryHeight > capacity) {
    last = { rows: [], used: 0, summary: false, conditions: false };
    pages.push(last);
  }
  last.summary = true;
  last.used += summaryHeight;
  const budgetIndex = s.options.sections.indexOf("budget");
  const conditionsHeight =
    65 +
    lines(
      s.quote.conditions || "No se han indicado condiciones adicionales.",
      layout.width - 4,
    ).length *
      16.5;
  const mergeConditions =
    s.options.sections[budgetIndex + 1] === "conditions" &&
    last.used + conditionsHeight <= capacity;
  last.conditions = mergeConditions;
  return { pages, mergeConditions };
}
function PageFrame({
  snapshot,
  letterhead,
  children,
  budget = false,
}: {
  snapshot: QuoteSnapshot;
  letterhead: Buffer;
  children: React.ReactNode;
  budget?: boolean;
}) {
  const m = snapshot.options.margins;
  return (
    <Page
      size="LETTER"
      style={[
        styles.page,
        {
          paddingTop:
            pt(m.top) + (budget ? budgetLayout(snapshot).headerHeight : 0),
          paddingBottom: pt(m.bottom),
          paddingLeft: pt(m.left),
          paddingRight: pt(m.right),
        },
      ]}
      wrap
    >
      <PdfImage
        fixed
        style={styles.background}
        src={{ data: letterhead, format: "png" }}
      />
      {children}
    </Page>
  );
}
function QuoteDocument({
  snapshot: s,
  letterhead,
}: {
  snapshot: QuoteSnapshot;
  letterhead: Buffer;
}) {
  const totals = calculateQuote(
    s.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: fromCents(i.unit_price_cents),
      discount: i.discount_rate,
      unit: i.unit,
    })),
    String(s.quote.vat_rate),
    s.quote.apply_vat,
  );
  const plan = splitAdvance(totals.total, String(s.quote.advance_rate));
  const m = s.options.margins;
  const layout = budgetLayout(s);
  const pagination = paginateBudget(s);
  return (
    <Document
      title={`${s.folio} · ${s.quote.name}`}
      author={s.organization.name}
      subject="Propuesta de servicios"
      language="es-MX"
    >
      {s.options.sections.map((section) =>
        section === "conditions" &&
        pagination.mergeConditions ? null : section === "budget" ? (
          pagination.pages.map((budgetPage, budgetIndex) => (
            <PageFrame
              key={section + budgetIndex}
              snapshot={s}
              letterhead={letterhead}
              budget
            >
              <Text
                fixed
                style={[
                  styles.tableTitle,
                  { top: pt(m.top), left: pt(m.left), right: pt(m.right) },
                ]}
              >
                COTIZACIÓN
              </Text>
              <View
                fixed
                style={{
                  position: "absolute",
                  top: pt(m.top) + 35,
                  left: pt(m.left),
                  right: pt(m.right),
                }}
              >
                <Text style={[styles.small, { marginBottom: 10 }]}>
                  {s.folio} · {s.organization.name}
                </Text>
                <Text style={styles.small}>{layout.client.join("\n")}</Text>
                <Text style={styles.small}>{layout.project.join("\n")}</Text>
                <Text style={[styles.small, { marginTop: 5 }]}>
                  Fecha: {s.issued_at.slice(0, 10)} · Moneda: MXN
                </Text>
              </View>
              {budgetPage.rows.length > 0 ? (
                <View
                  fixed
                  style={[
                    styles.tableHeader,
                    {
                      top: pt(m.top) + layout.headerHeight - 34,
                      left: pt(m.left),
                      right: pt(m.right),
                    },
                  ]}
                >
                  <Text style={styles.code}>CLAVE</Text>
                  <Text style={styles.desc}>CONCEPTO</Text>
                  <Text style={styles.unit}>UD.</Text>
                  <Text style={styles.qty}>CANT.</Text>
                  <Text style={styles.price}>P. UNIT. / %</Text>
                  <Text style={[styles.amount, { paddingRight: 5 }]}>
                    IMPORTE
                  </Text>
                </View>
              ) : (
                <Text
                  fixed
                  style={[
                    styles.subtitle,
                    {
                      position: "absolute",
                      top: pt(m.top) + layout.headerHeight - 34,
                      left: pt(m.left),
                      right: pt(m.right),
                    },
                  ]}
                >
                  Resumen económico
                </Text>
              )}
              {budgetPage.rows.map(({ index, part, description }) => {
                const item = s.items[index];
                return (
                  <View
                    key={`${index}-${part}`}
                    style={styles.row}
                    wrap={false}
                  >
                    <Text style={styles.code}>
                      {part ? "" : item.code || "-"}
                    </Text>
                    <View style={[styles.desc, part ? { width: "92%" } : {}]}>
                      <Text style={{ fontWeight: 500 }}>
                        {item.name}
                        {part ? " (continuación)" : ""}
                      </Text>
                      <Text>{description}</Text>
                      {part === 0 && Number(item.discount_rate) > 0 && (
                        <Text style={styles.small}>
                          Descuento: {item.discount_rate}%
                        </Text>
                      )}
                    </View>
                    {part === 0 && (
                      <>
                        <Text style={styles.unit}>
                          {part
                            ? ""
                            : (
                                {
                                  m2: "m²",
                                  pct: "%",
                                  hour: "h",
                                  visit: "visita",
                                  unit: "ud.",
                                  fixed: "fijo",
                                } as Record<string, string>
                              )[item.unit] || item.unit}
                        </Text>
                        <Text style={styles.qty}>
                          {part ? "" : item.quantity}
                        </Text>
                        <Text style={styles.price}>
                          {part
                            ? ""
                            : item.unit === "pct"
                              ? `${fromCents(item.unit_price_cents)}%`
                              : formatMoney(item.unit_price_cents)}
                        </Text>
                        <Text style={styles.amount}>
                          {part ? "" : formatMoney(totals.lines[index].net)}
                        </Text>
                      </>
                    )}
                  </View>
                );
              })}
              {budgetPage.summary && (
                <View wrap={false} style={styles.totals}>
                  {[
                    ["Subtotal", formatMoney(totals.subtotal)],
                    ["Descuentos", formatMoney(totals.discount)],
                    [
                      s.quote.apply_vat
                        ? `IVA ${s.quote.vat_rate}%`
                        : "IVA no aplicado",
                      formatMoney(totals.tax),
                    ],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.totalRow}>
                      <Text>{label}</Text>
                      <Text>{value}</Text>
                    </View>
                  ))}
                  <View style={[styles.totalRow, styles.grand]}>
                    <Text>Total MXN</Text>
                    <Text>{formatMoney(totals.total)}</Text>
                  </View>
                  <Text style={styles.small}>
                    Anticipo previsto {s.quote.advance_rate}%:{" "}
                    {formatMoney(plan.advance)}. Saldo:{" "}
                    {formatMoney(plan.balance)}.
                  </Text>
                  <Text style={styles.small}>
                    Vigencia: {s.quote.valid_until}. Este documento no acredita
                    pagos recibidos.
                  </Text>
                </View>
              )}
              {budgetPage.conditions && (
                <View style={{ marginTop: 24 }}>
                  <Text style={styles.subtitle} minPresenceAhead={44}>
                    Condiciones comerciales
                  </Text>
                  <Text orphans={3} widows={3}>
                    {s.quote.conditions ||
                      "No se han indicado condiciones adicionales."}
                  </Text>
                  <Text style={[styles.small, { marginTop: 12 }]}>
                    Vigencia: {s.quote.valid_until}.
                  </Text>
                </View>
              )}
            </PageFrame>
          ))
        ) : (
          <PageFrame key={section} snapshot={s} letterhead={letterhead}>
            <Text style={styles.eyebrow}>
              {s.folio} · {sectionLabels[section].toUpperCase()}
            </Text>
            {section === "cover" ? (
              <View>
                <Text style={[styles.title, { marginTop: 65 }]}>
                  COTIZACIÓN
                </Text>
                <Text style={styles.subtitle}>{s.quote.name}</Text>
                <Text style={styles.subtitle}>
                  Propuesta para {s.client.name}
                </Text>
                <Text>{s.organization.name}</Text>
                <Text style={styles.small}>
                  Fecha de emisión: {s.issued_at.slice(0, 10)}
                </Text>
              </View>
            ) : section === "thanks" ? (
              <>
                <Text style={styles.subtitle} minPresenceAhead={44}>
                  Gracias por compartir tu visión.
                </Text>
                <Text style={styles.text}>
                  Presentamos esta propuesta para {s.client.name}, con los
                  servicios y condiciones correspondientes a {s.quote.name}.
                </Text>
              </>
            ) : section === "scope" ? (
              <>
                <Text style={styles.subtitle} minPresenceAhead={44}>
                  {s.quote.name}
                </Text>
                <Text style={styles.subtitle}>{s.client.name}</Text>
                <Text style={styles.small}>
                  {[s.client.email, s.client.phone, s.client.address]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <Text
                  style={[styles.text, { marginTop: 22 }]}
                  orphans={3}
                  widows={3}
                >
                  {s.quote.notes ||
                    "El alcance contratado se detalla en las partidas del presupuesto."}
                </Text>
              </>
            ) : section === "conditions" ? (
              <>
                <Text style={styles.subtitle} minPresenceAhead={44}>
                  Condiciones comerciales
                </Text>
                <Text style={styles.text} orphans={3} widows={3}>
                  {s.quote.conditions ||
                    "No se han indicado condiciones adicionales."}
                </Text>
                <Text>Vigencia: {s.quote.valid_until}.</Text>
              </>
            ) : (
              <>
                <Text style={styles.subtitle} minPresenceAhead={44}>
                  Aceptación
                </Text>
                <Text style={styles.text}>
                  Al aceptar esta propuesta, las partes confirman el alcance y
                  las condiciones indicados en el documento {s.folio}.
                </Text>
                <Text style={styles.signature}>
                  {s.client.name} · Nombre y firma del cliente
                </Text>
                <Text style={styles.signature}>
                  {s.organization.name} · Nombre y firma del estudio
                </Text>
                <Text style={[styles.small, { marginTop: 30 }]}>
                  Fecha de aceptación: ____________________
                </Text>
              </>
            )}
          </PageFrame>
        ),
      )}
    </Document>
  );
}
export class ReactPdfRenderer implements DocumentRenderer {
  async render(input: QuoteSnapshot) {
    const snapshot = quoteSnapshotSchema.parse(input);
    const computed = calculateQuote(
      snapshot.items.map((i) => ({
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: fromCents(i.unit_price_cents),
        discount: i.discount_rate,
      })),
      String(snapshot.quote.vat_rate),
      snapshot.quote.apply_vat,
    );
    if (
      computed.total !== snapshot.quote.total_cents ||
      computed.subtotal !== snapshot.quote.subtotal_cents ||
      computed.discount !== snapshot.quote.discount_cents ||
      computed.tax !== snapshot.quote.tax_cents
    )
      throw new Error(
        "Los totales del documento no coinciden con sus partidas.",
      );
    const letterhead = await readFile(
      path.join(process.cwd(), "branding/membretes/MEMBRETA_CARTA_AT.png"),
    );
    const rendered = await renderToBuffer(
      <QuoteDocument snapshot={snapshot} letterhead={letterhead} />,
    );
    // Posprocesado después de paginar: evita el posicionamiento inestable de
    // nodos Text dinámicos en páginas envueltas del motor de composición.
    const pdf = await PDFDocument.load(rendered);
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(
      await readFile(
        path.join(process.cwd(), "assets/fonts/Poppins-Regular.ttf"),
      ),
      { subset: true },
    );
    const pages = pdf.getPages();
    pages.forEach((page, index) => {
      const label = `${snapshot.folio} · ${index + 1} / ${pages.length}`;
      const size = 9;
      page.drawText(label, {
        x:
          612 -
          pt(snapshot.options.margins.right) -
          font.widthOfTextAtSize(label, size),
        y: pt(snapshot.options.margins.bottom) - 20,
        font,
        size,
        color: rgb(0.39, 0.44, 0.4),
      });
    });
    return Buffer.from(await pdf.save());
  }
}
export function validateMargins(options: DocumentOptions) {
  return snapshotOptions(options);
}
function snapshotOptions(options: DocumentOptions) {
  return {
    width: 215.9 - options.margins.left - options.margins.right,
    height: 279.4 - options.margins.top - options.margins.bottom,
  };
}

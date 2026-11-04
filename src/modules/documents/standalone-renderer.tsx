import { referencedImage } from "./image-references";
import { documentLines } from "./document-lines";
import {
  Document,
  Page,
  Text,
  Image as PdfImage,
  View,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  standaloneSnapshotSchema,
  resolveDocumentBody,
  documentKinds,
  type StandaloneSnapshot,
} from "./standalone-schema";
import type { DocumentRenderer } from "./schema";
Font.register({
  family: "EstudioStandalone",
  fonts: [
    {
      src: path.join(
        process.cwd(),
        "assets/fonts/noto-sans-latin-400-normal.woff",
      ),
      fontWeight: 400,
    },
    {
      src: path.join(
        process.cwd(),
        "assets/fonts/noto-sans-latin-600-normal.woff",
      ),
      fontWeight: 600,
    },
  ],
});
const pt = (mm: number) => (mm * 72) / 25.4;
export class StandaloneRenderer implements DocumentRenderer<StandaloneSnapshot> {
  async render(
    input: StandaloneSnapshot,
    images: ReadonlyMap<string, Buffer> = new Map(),
  ) {
    const s = standaloneSnapshotSchema.parse(input);
    const lines = documentLines(s.body).map((block) => {
      if (typeof block !== "string")
        return {
          ...block,
          cells: block.cells.map((cell) => resolveDocumentBody(s, cell)),
        };
      const ref = referencedImage(block);
      if (!ref) return resolveDocumentBody(s, block);
      const bytes = images.get(ref);
      if (!bytes)
        throw Error("Imagen no disponible en la biblioteca de este estudio.");
      return { kind: "image" as const, bytes };
    });
    const letterhead = await readFile(
      path.join(process.cwd(), "branding/membretes/MEMBRETA_CARTA_AT.png"),
    );
    const content = (
      <Document title={s.title} author={s.organization.name} language="es-MX">
        <Page
          size="LETTER"
          wrap
          style={{
            fontFamily: "EstudioStandalone",
            fontSize: 10,
            color: "#182624",
            lineHeight: 1.65,
            paddingTop: pt(Math.max(32, s.margins.top)),
            paddingBottom: pt(s.margins.bottom),
            paddingLeft: pt(s.margins.left),
            paddingRight: pt(s.margins.right),
          }}
        >
          <PdfImage
            fixed
            src={{ data: letterhead, format: "png" }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 612,
              height: 792,
              objectFit: "contain",
            }}
          />
          <Text
            style={{
              fontSize: 7,
              color: "#64716b",
              letterSpacing: 1.2,
              marginBottom: 14,
            }}
          >
            {documentKinds[s.kind].toUpperCase()} · {s.date}
          </Text>
          <Text
            style={{
              fontSize: 24,
              fontWeight: 600,
              lineHeight: 1.25,
              marginBottom: 18,
            }}
          >
            {s.title}
          </Text>
          {(s.client || s.project) && (
            <View style={{ marginBottom: 20 }}>
              {s.client && <Text>{s.client.name}</Text>}
              {s.project && (
                <Text style={{ fontSize: 9, color: "#64716b" }}>
                  {s.project.name}
                </Text>
              )}
            </View>
          )}
          {lines.map((line, index) =>
            typeof line !== "string" && line.kind === "image" ? (
              <View key={index} wrap={false} style={{ marginVertical: 8 }}>
                <PdfImage
                  src={{ data: line.bytes, format: "jpg" }}
                  style={{
                    maxWidth: "100%",
                    maxHeight: 290,
                    objectFit: "contain",
                    objectPosition: "left",
                  }}
                />
              </View>
            ) : typeof line !== "string" ? (
              <View
                key={index}
                wrap={line.cells.some((c) => c.length > 200)}
                minPresenceAhead={line.header ? 26 : 0}
                style={{
                  flexDirection: "row",
                  backgroundColor: line.header ? "#e6eee9" : "#ffffff",
                  borderBottom: "0.5pt solid #b5c2bb",
                }}
              >
                {line.cells.map((cell, column) => (
                  <Text
                    key={column}
                    style={{
                      width: 100 / line.cells.length + "%",
                      padding: 4,
                      fontSize: 9,
                      fontWeight: line.header ? 600 : 400,
                    }}
                  >
                    {cell || " "}
                  </Text>
                ))}
              </View>
            ) : line.trim() === "[[salto]]" ? (
              <View key={index} break />
            ) : line.startsWith("## ") ? (
              <Text
                key={index}
                minPresenceAhead={35}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginTop: 12,
                  marginBottom: 8,
                }}
              >
                {line.slice(3)}
              </Text>
            ) : (
              <Text
                key={index}
                orphans={3}
                widows={3}
                style={{ marginBottom: line.trim() ? 7 : 8 }}
              >
                {line.startsWith("- ") ? "• " + line.slice(2) : line || " "}
              </Text>
            ),
          )}
        </Page>
      </Document>
    );
    const pdf = await PDFDocument.load(await renderToBuffer(content));
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();
    pages.forEach((page, index) => {
      const text = s.folio + " · " + (index + 1) + " / " + pages.length;
      page.drawText(text, {
        x: 612 - pt(s.margins.right) - font.widthOfTextAtSize(text, 7),
        y: pt(s.margins.bottom) - 15,
        size: 7,
        font,
        color: rgb(0.39, 0.44, 0.4),
      });
    });
    return Buffer.from(await pdf.save());
  }
}

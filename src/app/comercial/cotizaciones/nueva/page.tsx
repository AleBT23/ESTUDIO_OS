import Link from "next/link";
import { getEditorData } from "@/modules/quotes/editor-data";
import { QuoteEditor } from "@/modules/quotes/quote-editor";
export default async function NewQuotePage() {
  const { ctx, ...data } = await getEditorData();
  return (
    <>
      <Link href="/comercial/cotizaciones" className="back-link">
        ← Cotizaciones
      </Link>
      <div className="page-heading">
        <p className="eyebrow">CONSTRUYE UNA PROPUESTA</p>
        <h1>Nueva cotización</h1>
        <p>Solo lo necesario para empezar. Todo el espacio para detallar.</p>
      </div>
      <QuoteEditor {...data} lines={ctx.lines} />
    </>
  );
}

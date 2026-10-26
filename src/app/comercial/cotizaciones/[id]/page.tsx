import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getEditorData } from "@/modules/quotes/editor-data";
import { QuoteEditor } from "@/modules/quotes/quote-editor";
import { fromCents, formatMoney } from "@/shared/money";
import { Button } from "@/shared/ui/button";
import type { QuoteItem, QuoteHeader } from "@/modules/quotes/schema";
import { DocumentPanel } from "@/modules/documents/document-panel";
import { QuoteLifecyclePanel } from "@/modules/quotes/lifecycle-panel";
import { QuoteActions } from "@/modules/quotes/quote-actions";
export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { ctx, ...data } = await getEditorData();
  const { id } = await params;
  const { edit } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const [quoteResult, itemsResult] = await Promise.all([
    ctx.db
      .from("quotes")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    ctx.db
      .from("quote_items")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .eq("quote_id", id)
      .order("position"),
  ]);
  if (quoteResult.error || itemsResult.error)
    throw new Error("No se pudo cargar la cotización.");
  const quote = quoteResult.data;
  if (!quote) notFound();
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ctx.organization.timezone,
  }).format(new Date());
  const statusLabels: Record<string, string> = {
    draft: "Borrador",
    sent: "Enviada",
    accepted: "Aceptada",
    rejected: "Rechazada",
    expired: "Vencida",
  };
  const statusEvents = await ctx.db
    .from("quote_status_events")
    .select("id,status,reason,created_at")
    .eq("organization_id", ctx.organization.id)
    .eq("quote_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (statusEvents.error)
    throw new Error("No se pudo consultar el historial de la cotización.");
  const items: QuoteItem[] = (itemsResult.data || []).map((i) => ({
    service_id: i.service_id || "",
    business_line_id: i.business_line_id,
    name: i.name,
    description: i.description,
    quantity: String(i.quantity),
    unit: i.unit,
    unitPrice: fromCents(i.unit_price_cents),
    discount: String(i.discount_rate),
  }));
  const versions = await ctx.db
    .from("quote_versions")
    .select("id,folio,state,draft_version,version_number,issued_at")
    .eq("organization_id", ctx.organization.id)
    .eq("quote_id", id)
    .order("version_number", { ascending: false });
  if (versions.error)
    throw new Error("No se pudieron consultar las versiones.");
  const header: QuoteHeader = {
    client_id: quote.client_id,
    name: quote.name,
    vat_rate: String(quote.vat_rate),
    apply_vat: quote.apply_vat,
    advance_rate: String(quote.advance_rate),
    valid_until: quote.valid_until,
    notes: quote.notes,
    conditions: quote.conditions,
    estimated_hours: String(quote.estimated_hours),
    externalCost: fromCents(quote.external_cost_cents),
  };
  return (
    <>
      <Link href="/comercial/cotizaciones" className="back-link">
        ← Cotizaciones
      </Link>
      <div className="page-heading">
        <p className="eyebrow">
          {(statusLabels[quote.status] || "Estado por revisar").toUpperCase()} ·
          EDICIÓN {quote.version}
        </p>
        <h1>{quote.name}</h1>
        <QuoteActions
          id={id}
          name={quote.name}
          version={quote.version}
          accepted={quote.status === "accepted"}
          folio={versions.data?.find((v) => v.state === "issued")?.folio}
        />
        <p>
          {data.clients.find((c) => c.id === quote.client_id)?.name ||
            "Cliente archivado"}{" "}
          · MXN · Vigencia {quote.valid_until}
        </p>
      </div>
      {edit === "1" && quote.status === "draft" ? (
        <QuoteEditor
          key={id}
          {...data}
          lines={ctx.lines}
          initial={{ id, version: quote.version, header, items }}
        />
      ) : (
        <section className="panel padded">
          <div className="section-heading">
            <h2>Alcance de la propuesta</h2>
            {quote.status === "draft" && (
              <Button asChild variant="outline">
                <Link href={`/comercial/cotizaciones/${id}?edit=1`}>
                  Editar borrador
                </Link>
              </Button>
            )}
          </div>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {quote.notes || "Sin notas adicionales."}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Línea</th>
                  <th>Cantidad</th>
                  <th>Precio / %</th>
                  <th>Descuento</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      {item.name}
                      <small
                        style={{ display: "block", whiteSpace: "pre-wrap" }}
                        className="muted"
                      >
                        {item.description}
                      </small>
                    </td>
                    <td>
                      {
                        ctx.lines.find((l) => l.id === item.business_line_id)
                          ?.name
                      }
                    </td>
                    <td>{item.quantity}</td>
                    <td>
                      {item.unit === "pct"
                        ? `${item.unitPrice}%`
                        : `$${item.unitPrice}`}
                    </td>
                    <td>{item.discount}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="totals detail-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(quote.subtotal_cents)}</dd>
            </div>
            <div>
              <dt>Descuentos</dt>
              <dd>{formatMoney(quote.discount_cents)}</dd>
            </div>
            <div>
              <dt>
                IVA {quote.apply_vat ? `${quote.vat_rate}%` : "sin aplicar"}
              </dt>
              <dd>{formatMoney(quote.tax_cents)}</dd>
            </div>
            <div className="grand-total">
              <dt>Total MXN</dt>
              <dd>{formatMoney(quote.total_cents)}</dd>
            </div>
          </dl>
          {quote.conditions && (
            <div style={{ whiteSpace: "pre-wrap" }}>
              <h3>Condiciones</h3>
              {quote.conditions}
            </div>
          )}
          <p className="notice">
            Los importes corresponden a la cotización. El cobro efectivo se
            registra por separado en Administración.
          </p>
        </section>
      )}
      {["draft", "sent"].includes(quote.status) &&
        quote.valid_until < today && (
          <p className="notice" style={{ marginTop: 24 }}>
            La vigencia de esta propuesta concluyó. Registra el vencimiento o
            prepara una nueva revisión antes de solicitar la aceptación.
          </p>
        )}
      {edit !== "1" && (
        <DocumentPanel
          id={id}
          version={quote.version}
          status={quote.status}
          versions={versions.data || []}
          today={new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: ctx.organization.timezone,
          }).format(new Date())}
        />
      )}
      {edit !== "1" && (
        <QuoteLifecyclePanel
          key={id + ":" + quote.version}
          id={id}
          version={quote.version}
          status={quote.status}
          validUntil={quote.valid_until}
          today={today}
        />
      )}
      {edit !== "1" && statusEvents.data?.length > 0 && (
        <section className="panel padded" style={{ marginTop: 24 }}>
          <h2>Historial comercial</h2>
          {statusEvents.data.map((event) => (
            <div className="activity-row" key={event.id}>
              <strong>{statusLabels[event.status] || event.status}</strong>
              {event.reason && (
                <p style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>
                  {event.reason}
                </p>
              )}
              <small>
                {new Intl.DateTimeFormat("es-MX", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: ctx.organization.timezone,
                }).format(new Date(event.created_at))}
              </small>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

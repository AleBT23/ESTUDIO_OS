"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useUnsavedChanges } from "@/shared/ui/use-unsaved-changes";
import {
  calculateQuote,
  formatMoney,
  fromCents,
  splitAdvance,
  estimateFees,
} from "@/shared/money";
import { saveQuote } from "./actions";
import {
  units,
  type Service,
  type QuoteHeader,
  type QuoteItem,
} from "./schema";
import { insertConcept } from "./concept-schema";
type Preset = {
  id: string;
  name: string;
  notes: string;
  items: { service_id: string; quantity: string }[];
};
export function QuoteEditor({
  clients,
  services,
  lines,
  presets,
  concepts,
  initial,
  validUntil,
}: {
  clients: { id: string; name: string }[];
  services: Service[];
  lines: { id: string; name: string }[];
  presets: Preset[];
  concepts: { id: string; name: string; body: string }[];
  initial?: {
    id: string;
    version: number;
    header: QuoteHeader;
    items: QuoteItem[];
  };
  validUntil: string;
}) {
  const [state, action, pending] = useActionState(saveQuote, {});
  const [header, setHeader] = useState<QuoteHeader>(
    initial?.header || {
      client_id: "",
      name: "",
      vat_rate: "16",
      apply_vat: false,
      advance_rate: "50",
      valid_until: validUntil,
      notes: "",
      conditions: "",
      estimated_hours: "0",
      externalCost: "0.00",
    },
  );
  const [items, setItems] = useState<QuoteItem[]>(initial?.items || []);
  const [dirty, setDirty] = useState(false);
  const [loadedVersion] = useState(initial?.version || 0);
  const [full, setFull] = useState(Boolean(initial?.header.conditions));
  const [notice, setNotice] = useState("");
  useUnsavedChanges(dirty);
  function updateHeader<K extends keyof QuoteHeader>(
    key: K,
    value: QuoteHeader[K],
  ) {
    setDirty(true);
    setHeader({ ...header, [key]: value });
  }
  function updateItem<K extends keyof QuoteItem>(
    index: number,
    key: K,
    value: QuoteItem[K],
  ) {
    setDirty(true);
    setItems(
      items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }
  function itemFromService(service: Service, quantity = "1"): QuoteItem {
    return {
      service_id: service.id,
      name: service.name,
      description: service.description,
      business_line_id: service.business_line_id,
      unit: service.unit,
      unitPrice: fromCents(service.price_cents),
      quantity,
      discount: "0",
    };
  }
  function applyPreset(id: string) {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    const resolved = preset.items.map((i) => ({
      service: services.find((s) => s.id === i.service_id),
      quantity: i.quantity,
    }));
    if (resolved.some((i) => !i.service)) {
      setNotice(
        "Este preset contiene servicios archivados o vencidos. Edítalo antes de aplicarlo.",
      );
      return;
    }
    if (items.length + resolved.length > 100) {
      setNotice("Una propuesta admite hasta 100 partidas.");
      return;
    }
    setItems([
      ...items,
      ...resolved.map((i) => itemFromService(i.service!, i.quantity)),
    ]);
    if (preset.notes)
      setHeader({
        ...header,
        notes: [header.notes, preset.notes].filter(Boolean).join("\n\n"),
      });
    setDirty(true);
    setNotice("Preset aplicado. Los textos y precios son copias editables.");
  }
  let totals: ReturnType<typeof calculateQuote> | null = null;
  let advance: ReturnType<typeof splitAdvance> | null = null;
  let estimate: ReturnType<typeof estimateFees> | null = null;
  try {
    totals = calculateQuote(items, header.vat_rate, header.apply_vat);
    advance = splitAdvance(totals.total, header.advance_rate);
    estimate = estimateFees(
      totals.net,
      header.externalCost,
      header.estimated_hours,
    );
  } catch {
    /* Mostrar estado incompleto durante captura; validación al guardar. */
  }
  return (
    <form action={action} className="quote-form" data-dirty={dirty}>
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify({ header, items })}
      />
      <input type="hidden" name="id" value={initial?.id || ""} />
      <input type="hidden" name="version" value={loadedVersion} />
      <div className="toolbar">
        <div className="segmented" aria-label="Detalle de propuesta">
          <button
            type="button"
            aria-pressed={!full}
            onClick={() => setFull(false)}
            className={!full ? "selected" : ""}
          >
            Modo rápido
          </button>
          <button
            type="button"
            aria-pressed={full}
            onClick={() => setFull(true)}
            className={full ? "selected" : ""}
          >
            Propuesta completa
          </button>
        </div>
        <span className="caption">
          {dirty ? "Cambios sin guardar" : "Borrador privado"}
        </span>
      </div>
      <div className="quote-layout">
        <div className="quote-main">
          <section className="panel padded">
            <h2>El proyecto y su cliente</h2>
            <div className="form-grid">
              <label className="full">
                Nombre del proyecto *
                <input
                  value={header.name}
                  onChange={(e) => updateHeader("name", e.target.value)}
                  required
                  minLength={2}
                  maxLength={160}
                  placeholder="Da un nombre a esta propuesta"
                />
              </label>
              <label>
                Cliente *
                <select
                  value={header.client_id}
                  onChange={(e) => updateHeader("client_id", e.target.value)}
                  required
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vigencia hasta *
                <input
                  type="date"
                  required
                  value={header.valid_until}
                  onChange={(e) => updateHeader("valid_until", e.target.value)}
                />
              </label>
              <label className="full">
                Alcance y observaciones
                <textarea
                  value={header.notes}
                  onChange={(e) => updateHeader("notes", e.target.value)}
                  maxLength={10000}
                  rows={3}
                />
              </label>
            </div>
            {!clients.length && (
              <p className="notice" style={{ marginTop: 16 }}>
                Registra un cliente en Comercial antes de guardar una
                cotización.
              </p>
            )}
          </section>
          <section className="panel padded">
            <div className="section-heading">
              <h2>Servicios y alcance</h2>
              <span className="caption">{items.length} / 100 partidas</span>
            </div>
            <div className="catalog-pickers">
              <label>
                Agregar del catálogo
                <select
                  value=""
                  onChange={(e) => {
                    const svc = services.find((s) => s.id === e.target.value);
                    if (svc && items.length < 100) {
                      setItems([...items, itemFromService(svc)]);
                      setDirty(true);
                    }
                  }}
                >
                  <option value="">Seleccionar servicio…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Aplicar preset
                <select value="" onChange={(e) => applyPreset(e.target.value)}>
                  <option value="">Seleccionar preset…</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
            {items.map((item, index) => (
              <article className="quote-line" key={index}>
                <div className="section-heading">
                  <span className="caption">
                    PARTIDA {String(index + 1).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    className="icon-button danger-link"
                    aria-label={`Quitar partida ${index + 1}`}
                    onClick={() => {
                      setItems(items.filter((_, i) => i !== index));
                      setDirty(true);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="form-grid">
                  <label className="full">
                    Concepto *
                    <input
                      value={item.name}
                      onChange={(e) =>
                        updateItem(index, "name", e.target.value)
                      }
                      required
                      minLength={2}
                      maxLength={160}
                    />
                  </label>
                  <label>
                    Línea *
                    <select
                      value={item.business_line_id}
                      onChange={(e) =>
                        updateItem(index, "business_line_id", e.target.value)
                      }
                      required
                    >
                      <option value="">Seleccionar línea</option>
                      {lines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Unidad
                    <select
                      value={item.unit}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "unit",
                          e.target.value as QuoteItem["unit"],
                        )
                      }
                    >
                      {Object.entries(units).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {item.unit === "pct" ? "Costo de obra MXN" : "Cantidad"} *
                    <input
                      type="number"
                      inputMode="decimal"
                      required
                      min="0.0001"
                      step="0.0001"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, "quantity", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    {item.unit === "pct"
                      ? "Porcentaje de obra %"
                      : "Precio unitario MXN"}{" "}
                    *
                    <input
                      type="number"
                      inputMode="decimal"
                      required
                      min="0"
                      max={item.unit === "pct" ? 100 : 999999999999}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(index, "unitPrice", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Descuento %
                    <input
                      type="number"
                      inputMode="decimal"
                      required
                      min="0"
                      max="100"
                      step="0.0001"
                      value={item.discount}
                      onChange={(e) =>
                        updateItem(index, "discount", e.target.value)
                      }
                    />
                  </label>
                  <div className="line-amount">
                    <span className="caption">Importe neto</span>
                    <strong>
                      {totals
                        ? formatMoney(totals.lines[index].net)
                        : "Completa los importes"}
                    </strong>
                  </div>
                  <label className="full">
                    Insertar texto de la biblioteca
                    <select
                      value=""
                      aria-label={"Insertar concepto en partida " + (index + 1)}
                      onChange={(event) => {
                        const concept = concepts.find(
                          (c) => c.id === event.target.value,
                        );
                        if (!concept) return;
                        try {
                          updateItem(
                            index,
                            "description",
                            insertConcept(item.description, concept.body),
                          );
                          setNotice(
                            "Texto insertado como copia. El concepto original se conserva.",
                          );
                        } catch (error) {
                          setNotice(
                            error instanceof Error
                              ? error.message
                              : "No se pudo insertar el concepto.",
                          );
                        }
                      }}
                    >
                      <option value="">Seleccionar concepto…</option>
                      {concepts.map((concept) => (
                        <option value={concept.id} key={concept.id}>
                          {concept.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="full">
                    Descripción del concepto
                    <textarea
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, "description", e.target.value)
                      }
                      maxLength={10000}
                      rows={3}
                    />
                  </label>
                </div>
              </article>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={items.length >= 100}
              onClick={() => {
                setDirty(true);
                setItems([
                  ...items,
                  {
                    service_id: "",
                    business_line_id: lines[0]?.id || "",
                    name: "",
                    description: "",
                    quantity: "1",
                    unit: "fixed",
                    unitPrice: "0.00",
                    discount: "0",
                  },
                ]);
              }}
            >
              <Plus size={15} />
              Partida personalizada
            </Button>
          </section>
          {full && (
            <section className="panel padded">
              <h2>Condiciones de la propuesta</h2>
              <label>
                Condiciones, exclusiones y forma de trabajo
                <textarea
                  value={header.conditions}
                  onChange={(e) => updateHeader("conditions", e.target.value)}
                  maxLength={20000}
                  rows={6}
                />
              </label>
              <p className="caption">Cambiar de modo conserva este texto.</p>
            </section>
          )}
          <section className="panel padded">
            <h2>Estimación interna</h2>
            <p className="caption">
              Solo administración. No se ha emitido ningún documento al cliente.
            </p>
            <div className="form-grid">
              <label>
                Horas previstas
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  min="0"
                  step="0.0001"
                  value={header.estimated_hours}
                  onChange={(e) =>
                    updateHeader("estimated_hours", e.target.value)
                  }
                />
              </label>
              <label>
                Costos externos previstos MXN
                <input
                  type="number"
                  inputMode="decimal"
                  required
                  min="0"
                  step="0.01"
                  value={header.externalCost}
                  onChange={(e) => updateHeader("externalCost", e.target.value)}
                />
              </label>
            </div>
            <dl className="totals">
              <div>
                <dt>Ingreso previsto sin IVA</dt>
                <dd>{totals ? formatMoney(totals.net) : "—"}</dd>
              </div>
              <div>
                <dt>Resultado antes de costo de horas</dt>
                <dd>{estimate ? formatMoney(estimate.profitCents) : "—"}</dd>
              </div>
              <div>
                <dt>Margen estimado</dt>
                <dd>
                  {estimate?.marginPercent !== null &&
                  estimate?.marginPercent !== undefined
                    ? estimate.marginPercent + "%"
                    : "Sin ingreso para calcular"}
                </dd>
              </div>
              <div>
                <dt>Ingreso previsto por hora</dt>
                <dd>
                  {estimate?.effectiveHourlyCents !== null &&
                  estimate?.effectiveHourlyCents !== undefined
                    ? formatMoney(estimate.effectiveHourlyCents)
                    : "Indica las horas previstas"}
                </dd>
              </div>
            </dl>
            <p className="caption">
              Fórmulas: resultado = ingreso neto sin IVA menos costos externos;
              margen = resultado / ingreso neto; ingreso por hora = ingreso neto
              / horas. El costo imputado de horas se reportará por separado
              cuando se definan tarifas. Esta estimación no representa cobros ni
              utilidad real.
            </p>
          </section>
        </div>
        <aside className="quote-summary panel padded">
          <p className="eyebrow">RESUMEN DE LA PROPUESTA</p>
          <h2>Todo, a la vista.</h2>
          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{totals ? formatMoney(totals.subtotal) : "—"}</dd>
            </div>
            <div>
              <dt>Descuentos</dt>
              <dd>{totals ? formatMoney(totals.discount) : "—"}</dd>
            </div>
            <div>
              <dt>Importe neto</dt>
              <dd>{totals ? formatMoney(totals.net) : "—"}</dd>
            </div>
          </dl>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={header.apply_vat}
              onChange={(e) => updateHeader("apply_vat", e.target.checked)}
            />
            Aplicar IVA a esta propuesta
          </label>
          <label>
            IVA %
            <input
              type="number"
              inputMode="decimal"
              required
              min="0"
              max="100"
              step="0.0001"
              value={header.vat_rate}
              onChange={(e) => updateHeader("vat_rate", e.target.value)}
            />
          </label>
          <dl className="totals">
            <div>
              <dt>IVA</dt>
              <dd>{totals ? formatMoney(totals.tax) : "—"}</dd>
            </div>
            <div className="grand-total">
              <dt>Total MXN</dt>
              <dd>{totals ? formatMoney(totals.total) : "—"}</dd>
            </div>
          </dl>
          <label>
            Anticipo previsto %
            <input
              type="number"
              inputMode="decimal"
              required
              min="0"
              max="100"
              step="0.0001"
              value={header.advance_rate}
              onChange={(e) => updateHeader("advance_rate", e.target.value)}
            />
          </label>
          <p className="caption" style={{ marginTop: 14 }}>
            Anticipo: {advance ? formatMoney(advance.advance) : "—"}
            <br />
            Saldo: {advance ? formatMoney(advance.balance) : "—"}
            <br />
            Guardar el borrador no registra ningún cobro.
          </p>
          {state.error && (
            <p className="notice error" role="alert">
              {state.error}
            </p>
          )}
          <Button disabled={pending || !clients.length || !items.length}>
            {pending ? "Guardando…" : "Guardar borrador"}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/comercial/cotizaciones">Volver a cotizaciones</Link>
          </Button>
          <p className="caption" style={{ marginTop: 18 }}>
            Guarda el borrador para previsualizar y emitir su PDF con membrete
            desde la ficha de cotización.
          </p>
        </aside>
      </div>
    </form>
  );
}

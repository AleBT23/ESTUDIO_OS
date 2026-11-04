import { formatMoney } from "@/shared/money";
export const kinds: Record<string, string> = {
  project_end: "Cierre previsto de proyecto",
  agreement_collection: "Cobro de acuerdo",
  agreement_payment: "Pago de acuerdo",
  personal: "Recordatorio personal",
  task: "Pendiente",
  collection: "Cobro pendiente",
  delivery: "Entrega",
  follow_up: "Seguimiento comercial",
  publication: "Publicación programada",
};
export function eventHref(event: {
  kind: string;
  id: string;
  project_id: string | null;
}) {
  if (event.kind === "collection")
    return `/proyectos/${event.project_id}?obligacion=${event.id}#plan-cobro`;
  if (event.kind === "personal") return "/agenda/recordatorios?id=" + event.id;
  if (
    event.kind === "agreement_collection" ||
    event.kind === "agreement_payment"
  )
    return "/administracion/operaciones/" + event.id;
  if (event.kind === "follow_up")
    return "/comercial/pipeline?selected=" + event.id;
  if (event.kind === "publication")
    return "/comercial/marketing?edit=" + event.id;
  return "/proyectos/" + event.project_id;
}

export function eventTypeLabel(e: {
  kind: string;
  balance_cents: string | null;
  managed: boolean | null;
}) {
  if (e.balance_cents == null) return kinds[e.kind];
  return [
    kinds[e.kind],
    "Saldo " + formatMoney(BigInt(e.balance_cents)),
    e.managed ? "Fondos del cliente" : "Fondos propios",
  ].join(" · ");
}

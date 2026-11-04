export const kinds: Record<string, string> = {
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
  if (event.kind === "follow_up")
    return "/comercial/pipeline?selected=" + event.id;
  if (event.kind === "publication")
    return "/comercial/marketing?edit=" + event.id;
  return "/proyectos/" + event.project_id;
}

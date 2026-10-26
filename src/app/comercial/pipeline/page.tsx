import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { CommercialTabs } from "@/shared/ui/commercial-tabs";
import { Button } from "@/shared/ui/button";
import { OpportunityForm } from "@/modules/crm/opportunity-form";
import { stages, type Opportunity } from "@/modules/crm/pipeline-schema";
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ selected?: string; new?: string; line?: string }>;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return (
      <p className="notice">
        El pipeline comercial está disponible para administradores.
      </p>
    );
  const filter = await searchParams;
  const line = ctx.lines.find((l) => l.id === filter.line)?.id;
  let query = ctx.db
    .from("opportunities")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (line) query = query.eq("business_line_id", line);
  const [opps, clients] = await Promise.all([
    query,
    ctx.db
      .from("clients")
      .select("id,name")
      .eq("organization_id", ctx.organization.id)
      .is("deleted_at", null)
      .order("name")
      .limit(500),
  ]);
  if (opps.error || clients.error)
    throw new Error("No se pudo cargar el pipeline.");
  const opportunities = (opps.data || []) as Opportunity[];
  const selected = opportunities.find((o) => o.id === filter.selected);
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ctx.organization.timezone,
  }).format(new Date());
  const followups = opportunities.filter(
    (o) =>
      o.next_follow_up &&
      o.next_follow_up <= today &&
      !["won", "lost"].includes(o.stage),
  );
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">CONVERSACIONES EN MOVIMIENTO</p>
        <h1>Pipeline comercial</h1>
        <p>Cada oportunidad, con un siguiente paso.</p>
      </div>
      <CommercialTabs active="/comercial/pipeline" />
      {selected || filter.new === "1" ? (
        <OpportunityForm
          opportunity={filter.new === "1" ? undefined : selected}
          clients={clients.data || []}
          lines={ctx.lines}
        />
      ) : (
        <>
          <div className="toolbar">
            <form className="search-form">
              <select
                name="line"
                aria-label="Línea de oportunidades"
                defaultValue={line || ""}
              >
                <option value="">Todas las líneas</option>
                {ctx.lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <Button variant="outline">Filtrar</Button>
            </form>
            <Button asChild>
              <Link href="/comercial/pipeline?new=1">Nueva oportunidad +</Link>
            </Button>
          </div>
          {followups.length > 0 && (
            <p className="notice" role="status">
              {followups.length} oportunidades tienen seguimiento previsto para
              hoy o una fecha anterior.
            </p>
          )}
          <div className="pipeline-board">
            {Object.entries(stages).map(([stage, label]) => {
              const list = opportunities.filter((o) => o.stage === stage);
              return (
                <section className="pipeline-column" key={stage}>
                  <h2>
                    {label}
                    <span>{list.length}</span>
                  </h2>
                  {list.map((opp) => (
                    <Link
                      className="pipeline-card"
                      href={`/comercial/pipeline?selected=${opp.id}`}
                      key={opp.id}
                    >
                      <strong>{opp.name}</strong>
                      <span>
                        {clients.data?.find((c) => c.id === opp.client_id)
                          ?.name || "Cliente archivado"}
                      </span>
                      <small>
                        {
                          ctx.lines.find((l) => l.id === opp.business_line_id)
                            ?.name
                        }
                      </small>
                      {opp.next_follow_up &&
                        !["won", "lost"].includes(stage) && (
                          <p
                            className={
                              opp.next_follow_up <= today ? "followup-due" : ""
                            }
                          >
                            Seguimiento {opp.next_follow_up}
                          </p>
                        )}
                    </Link>
                  ))}
                  {!list.length && (
                    <p className="caption">Sin oportunidades en esta etapa</p>
                  )}
                </section>
              );
            })}
          </div>
          <p className="caption">
            Hasta 500 oportunidades por filtro. Abre una tarjeta para actualizar
            etapa, notas y seguimiento.
          </p>
        </>
      )}
    </>
  );
}

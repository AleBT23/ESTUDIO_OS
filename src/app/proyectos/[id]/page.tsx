import {ProjectDetails} from "@/modules/projects/project-details";
import {ProjectPerformance} from "@/modules/projects/project-performance";
import { PhasePanel } from "@/modules/projects/phase-panel";
import { DeliveryPanel } from "@/modules/projects/delivery-panel";
import { canManageCommercial } from "@/shared/permissions";
import { TimePanel } from "@/modules/projects/time-panel";
import { FeePanel } from "@/modules/finance/fee-panel";
import { Changes } from "@/modules/projects/change-panel";
import Link from "next/link";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireContext } from "@/shared/auth/context";
import { ProjectFinance } from "@/modules/projects/finance";
import { ProjectWorkspace } from "@/modules/projects/workspace";
const scopeSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string(),
    quantity: z.string(),
    unit: z.string(),
  }),
);
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    notes?: string;
    visits?: string;
    payments?: string;
    tiempo?: string;
    honorarios?: string;
    cambios?: string;
    entregas?: string;
    entrega?: string;
    revisiones?: string;
  }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;
  const filter = await searchParams;
  const page = (n?: string) =>
    Math.max(1, Math.min(10000, parseInt(n || "1") || 1));
  if (!z.uuid().safeParse(id).success) notFound();
  const [projectResult, packagesResult] = await Promise.all([
    ctx.db
      .from("projects")
      .select("id,name,client_id,state,start_date,quote_version_id,version,location,target_end,lead_id")
      .eq("organization_id", ctx.organization.id)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    ctx.db
      .from("project_service_packages")
      .select("id,name,scope,business_line_id")
      .eq("organization_id", ctx.organization.id)
      .eq("project_id", id)
      .order("created_at"),
  ]);
  if (projectResult.error || packagesResult.error)
    throw new Error("No se pudo consultar el proyecto.");
  const project = projectResult.data;
  if (!project) notFound();
  const client = await ctx.db
    .from("clients")
    .select("name")
    .eq("organization_id", ctx.organization.id)
    .eq("id", project.client_id)
    .single();
  if (client.error) throw new Error("No se pudo consultar el cliente.");
  return (
    <>
      <Link className="back-link" href="/proyectos">
        ← Proyectos
      </Link>
      <div className="page-heading">
        <p className="eyebrow">EXPEDIENTE DEL PROYECTO</p>
        <h1>{project.name}</h1>
        <p>
          {client.data.name}
        </p>
      </div>
      <ProjectDetails project={project}/>
      {packagesResult.data?.length ? (
        <>
          <div className="section-heading">
            <h2>Paquetes de servicios</h2>
            <span className="caption">
              Un expediente · {packagesResult.data?.length || 0} líneas
              contratadas
            </span>
          </div>
          <div className="settings-grid">
            {packagesResult.data?.map((pkg) => (
              <section key={pkg.id} className="panel padded">
                <p className="eyebrow">
                  {ctx.lines.find((l) => l.id === pkg.business_line_id)?.name}
                </p>
                <h2>{pkg.name}</h2>
                {scopeSchema.parse(pkg.scope).map((item, index) => (
                  <div className="activity-row" key={index}>
                    <strong>{item.name}</strong>
                    <p
                      className="caption"
                      style={{ whiteSpace: "pre-wrap", marginTop: 6 }}
                    >
                      {item.description || "Sin descripción adicional"}
                    </p>
                    <small>Cantidad contratada: {item.quantity}</small>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </>
      ) : null}
      {canManageCommercial(ctx.membership.role) && (
        <Link href={"/comercial/contratos?proyecto=" + id}>
          Contratos del proyecto
        </Link>
      )}
      <PhasePanel project={id} />
      <DeliveryPanel
        id={id}
        page={page(filter.entregas)}
        selected={filter.entrega}
        historyPage={page(filter.revisiones)}
      />
      <Changes
        project={id}
        client={project.client_id}
        page={page(filter.cambios)}
      />
      <ProjectWorkspace
        project={id}
        notesPage={page(filter.notes)}
        visitsPage={page(filter.visits)}
      />
      <FeePanel
        project={id}
        packages={packagesResult.data ?? []}
        page={page(filter.honorarios)}
      />
      <ProjectPerformance project={id}/>
      <TimePanel project={id} page={page(filter.tiempo)} />
      <ProjectFinance
        project={id}
        name={project.name}
        version={project.version}
        manual={!project.quote_version_id}
        page={page(filter.payments)}
      />
    </>
  );
}

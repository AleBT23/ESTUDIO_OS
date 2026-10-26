import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { NewProjectForm } from "@/modules/projects/forms";
import { projectWorkspaceReady } from "@/modules/projects/availability";
export default async function NewProjectPage() {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p className="notice">Tu rol no permite crear proyectos.</p>;
  const clients = await ctx.db
    .from("clients")
    .select("id,name")
    .eq("organization_id", ctx.organization.id)
    .is("deleted_at", null)
    .order("name")
    .limit(500);
  if (clients.error) throw new Error("No se pudieron cargar los clientes.");
  return (
    <>
      <Link className="back-link" href="/proyectos">
        ← Proyectos
      </Link>
      <div className="page-heading">
        <p className="eyebrow">UN EXPEDIENTE PARA CADA OBRA</p>
        <h1>Nuevo proyecto</h1>
        <p>
          Registra una obra o encargo existente sin crear una cotización
          ficticia.
        </p>
      </div>
      <NewProjectForm
        clients={clients.data || []}
        today={new Intl.DateTimeFormat("en-CA", {
          timeZone: ctx.organization.timezone,
        }).format(new Date())}
        requestId={crypto.randomUUID()}
      />
      <p className="caption">
        Selector limitado a 500 clientes activos. Si necesitas uno nuevo, créalo
        antes de continuar.
      </p>
    </>
  );
  if (!(await projectWorkspaceReady()))
    return (
      <p className="notice">
        El registro directo de proyectos está en preparación. Puedes seguir
        creando expedientes al aceptar tus cotizaciones.
      </p>
    );
}

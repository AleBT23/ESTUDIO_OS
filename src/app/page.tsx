import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Check,
  ShieldCheck,
  Users,
  Workflow,
  FileText,
} from "lucide-react";
import { getContext } from "@/shared/auth/context";
import { isConfigured } from "@/shared/db/server";
import { formatMoney } from "@/shared/money";
import { canReadFinance, canManageCommercial } from "@/shared/permissions";
import { AreaIndicators } from "@/modules/finance/area-indicators";
import { DashboardTasks } from "@/modules/projects/workspace";
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ pendingPage?: string }>;
}) {
  const ctx = await getContext();
  const filter = await searchParams;
  const pendingPage = Math.max(
    1,
    Math.min(10000, parseInt(filter.pendingPage || "1") || 1),
  );
  if (ctx?.organization && ctx.membership) {
    const org = ctx.organization.id;
    const commercial = canManageCommercial(ctx.membership.role);
    const [projects, quotes, balances, notifications] = await Promise.all([
      ctx.db
        .from("projects")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", org)
        .eq("state", "active")
        .is("deleted_at", null),
      commercial
        ? ctx.db
            .from("quotes")
            .select("id", { head: true, count: "exact" })
            .eq("organization_id", org)
            .eq("status", "sent")
            .is("deleted_at", null)
        : null,
      canReadFinance(ctx.membership.role)
        ? ctx.db
            .from("project_financial_summary")
            .select("project_id,collected_cents,balance_cents")
            .eq("organization_id", org)
            .gt("balance_cents", 0)
            .order("balance_cents", { ascending: false })
            .order("project_id")
            .limit(5)
        : null,
      ctx.db
        .from("agenda_notifications")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", org)
        .is("read_at", null),
    ]);
    const ids = balances?.data?.map((row) => row.project_id) ?? [];
    const names = ids.length
      ? await ctx.db
          .from("projects")
          .select("id,name")
          .eq("organization_id", org)
          .in("id", ids)
      : null;
    const projectNames = new Map(names?.data?.map((row) => [row.id, row.name]));
    return (
      <>
        <header className="page-heading">
          <p className="eyebrow">{ctx.organization.name}</p>
          <h1>Centro de operaciones</h1>
        </header>
        <div className="overview-grid">
          <Link href="/proyectos" className="panel overview-card">
            <h2>Proyectos activos</h2>
            <strong>
              {projects.error ? "Consulta no disponible" : projects.count}
            </strong>
          </Link>
          {quotes && (
            <Link
              href="/comercial/cotizaciones"
              className="panel overview-card"
            >
              <h2>Cotizaciones enviadas</h2>
              <strong>
                {quotes.error ? "Consulta no disponible" : quotes.count}
              </strong>
            </Link>
          )}
        </div>
        {commercial && (
          <nav aria-label="Acciones rápidas" className="form-actions">
            <Link
              className="button button-primary"
              href="/comercial/cotizaciones/nueva"
            >
              Nueva cotización
            </Link>
            <Link className="button button-outline" href="/proyectos/nuevo">
              Nuevo proyecto
            </Link>
            <Link className="button button-outline" href="/administracion">
              Consultar cobros
            </Link>
          </nav>
        )}
        {balances && (
          <section className="panel padded">
            <h2>Proyectos con mayor saldo por cobrar</h2>
            {balances.error || names?.error ? (
              <p role="status">No se pudieron consultar los saldos.</p>
            ) : balances.data?.length ? (
              <div className="table-scroll">
                <table>
                  <caption>Los cinco mayores saldos pendientes en MXN</caption>
                  <thead>
                    <tr>
                      <th>Proyecto</th>
                      <th>Cobrado</th>
                      <th>Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.data.map((row) => (
                      <tr key={row.project_id}>
                        <td>
                          <Link href={"/proyectos/" + row.project_id}>
                            {projectNames.get(row.project_id) ??
                              "Abrir expediente"}
                          </Link>
                        </td>
                        <td>{formatMoney(row.collected_cents)}</td>
                        <td>{formatMoney(row.balance_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No hay proyectos con saldo pendiente.</p>
            )}
          </section>
        )}
        <AreaIndicators />
        <p>
          <Link href="/agenda/notificaciones">
            Notificaciones internas
            {notifications.error
              ? ""
              : " · " + (notifications.count ?? 0) + " sin leer"}
          </Link>
        </p>
        <p>
          <Link href="/buscar?favorites=1">Mis favoritos</Link>
        </p>
        <DashboardTasks page={pendingPage} />
      </>
    );
  }
  return (
    <>
      <div className="page-heading home-heading">
        <div>
          <p className="eyebrow">TU ESTUDIO, EN PERSPECTIVA</p>
          <h1>
            Espacio para crear.
            <br />
            <span>Claridad para avanzar.</span>
          </h1>
          <p>El trabajo de tu estudio, conectado de principio a fin.</p>
        </div>
        <span className="quiet-tag">
          <span className="status-dot" />
          {ctx?.organization ? "Espacio conectado" : "Preparando tu espacio"}
        </span>
      </div>
      <section className="welcome-panel">
        <div className="welcome-copy">
          <p className="eyebrow">UNA VISIÓN COMPARTIDA</p>
          <h2>
            Arquitectura.
            <br />
            Visualización.
            <br />
            <em>Un mismo estudio.</em>
          </h2>
          <p>
            De la primera conversación a la última entrega.
            <br />
            Cada cliente, decisión y detalle en su lugar.
          </p>
          <Link
            className="button button-primary"
            href={ctx?.organization ? "/comercial" : "/configuracion"}
          >
            {ctx?.organization ? "Abrir Comercial" : "Configurar mi estudio"}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="brand-composition">
          <div className="draft-line vertical" />
          <div className="draft-line horizontal" />
          <Image
            src="/marca/logo-ab.png"
            alt="Logo de Alejandro Barajas Arquitectura"
            width={240}
            height={80}
            priority
          />
          <span className="composition-label">
            ALEJANDRO BARAJAS
            <br />
            ARQUITECTURA
          </span>
          <span className="drawing-ref">AB / 01</span>
        </div>
      </section>
      <div className="section-heading">
        <h2>El siguiente paso, claro</h2>
        <span className="caption">Construyendo sobre una base sólida</span>
      </div>
      <div className="overview-grid">
        <Link href="/configuracion" className="panel overview-card">
          <ShieldCheck size={21} />
          <span className="step-number">01</span>
          <h3>Prepara tu espacio</h3>
          <p>Conecta tu base privada y crea el espacio de tu estudio.</p>
          <span className="card-action">
            {ctx?.organization ? (
              <>
                <Check size={14} />
                Espacio creado
              </>
            ) : isConfigured() ? (
              "Continuar configuración"
            ) : (
              "Configurar conexión"
            )}
            <ArrowUpRight size={15} />
          </span>
        </Link>
        <Link href="/comercial" className="panel overview-card">
          <Users size={21} />
          <span className="step-number">02</span>
          <h3>Comienza con tus clientes</h3>
          <p>Organiza personas, empresas y el contexto de cada relación.</p>
          <span className="card-action">
            Abrir clientes
            <ArrowUpRight size={15} />
          </span>
        </Link>
        <Link href="/recursos" className="panel overview-card">
          <FileText size={21} />
          <span className="step-number">03</span>
          <h3>Cuida cada documento</h3>
          <p>
            Identidad del estudio y documentos consistentes en cada entrega.
          </p>
          <span className="card-action">
            Ver recursos
            <ArrowUpRight size={15} />
          </span>
        </Link>
      </div>
      <section className="inline-note">
        <Workflow size={19} />
        <p>
          El resumen de actividad aparecerá cuando los flujos y sus indicadores
          estén implementados y conectados a tus datos.
        </p>
      </section>
    </>
  );
}

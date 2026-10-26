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
      {ctx?.organization && (
        <>
          <DashboardTasks page={pendingPage} />
          <p className="sync-caption">
            Tus datos se guardan en Supabase y se comparten entre teléfono y PC.
            Al volver a esta pestaña se actualiza la vista.
          </p>
        </>
      )}
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
            src="/marca/isotipo.png"
            alt="Isotipo oficial del estudio"
            width={210}
            height={210}
            priority
          />
          <span className="composition-label">
            ALEJANDRO TORRES
            <br />
            ARQUITECTURA
          </span>
          <span className="drawing-ref">AT / 01</span>
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

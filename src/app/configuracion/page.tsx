import { WorkspaceExportCheck } from "@/shared/ui/workspace-export-check";
import { StageLegacyPanel } from "@/modules/crm/stage-legacy-panel";
import { LegacyReviewPanel } from "@/modules/crm/legacy-review-panel";
import { Check, Circle, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { getContext } from "@/shared/auth/context";
import { isConfigured } from "@/shared/db/server";
import { WorkspaceForm } from "@/shared/ui/auth-forms";
export default async function SettingsPage() {
  const configured = isConfigured();
  const ctx = await getContext();
  const steps = [
    ["Conectar la base de datos", configured],
    ["Iniciar sesión", !!ctx],
    ["Crear el espacio del estudio", !!ctx?.organization],
  ] as const;
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">A TU MANERA</p>
        <h1>Configuración</h1>
        <p>Una base cuidada para todo lo que viene.</p>
      </div>
      <div className="settings-grid">
        <section className="panel padded">
          <h2>Tu espacio, conectado</h2>
          <p className="muted">
            Los datos del estudio se guardan en una base privada. Completa estos
            pasos para comenzar.
          </p>
          <ol className="setup-steps">
            {steps.map(([label, done]) => (
              <li key={label}>
                {done ? <Check size={18} /> : <Circle size={18} />}
                <span>{label}</span>
                <small>{done ? "Listo" : "Pendiente"}</small>
              </li>
            ))}
          </ol>
          {!configured ? (
            <div className="notice">
              <p>Conexión pendiente</p>
              <p>
                Copia <code>.env.example</code> a <code>.env.local</code> y
                configura la URL y clave pública de Supabase. La guía local
                incluye las migraciones y la creación del primer usuario.
              </p>
              <p>
                Consulta <code>docs/GUIA-DESARROLLO.md</code>.
              </p>
            </div>
          ) : !ctx ? (
            <Link className="button button-primary" href="/acceso">
              Iniciar sesión
              <ArrowUpRight size={16} />
            </Link>
          ) : !ctx.organization ? (
            <>
              <Link href="/invitaciones">Consultar mis invitaciones</Link>
              <WorkspaceForm />
            </>
          ) : (
            <div className="notice success">
              <strong>{ctx.organization.name}</strong>
              <p>
                Moneda: {ctx.organization.currency} · Zona horaria:{" "}
                {ctx.organization.timezone}
              </p>
              <p>Rol: {ctx.membership?.role}</p>
              {ctx.membership?.role === "owner" && (
                <Link href="/configuracion/equipo">
                  Administrar equipo y permisos
                </Link>
              )}
            </div>
          )}
        </section>
        <section className="panel padded">
          <p className="eyebrow">CONTINUIDAD DEL ESTUDIO</p>
          <h2>
            Tu información anterior,
            <br />
            con cuidado.
          </h2>
          <p className="muted">
            El tabulador anterior conserva sus datos en el navegador donde lo
            utilizabas. El archivo RAR no es un respaldo de esa información.
          </p>
          <p className="muted">
            El exportador de solo lectura está preparado en el proyecto. Genera
            un archivo con fecha, conteos y huella de verificación.
          </p>
          <a className="text-link" href="/legacy-export.js" download>
            Descargar exportador del tabulador
            <ArrowUpRight size={16} />
          </a>
          <p className="caption">
            Sigue las instrucciones de docs/AUDITORIA-LEGACY.md antes de
            ejecutarlo en el navegador original. La importación sigue pendiente
            de validación.
          </p>
        </section>
      </div>
      {ctx?.membership?.role === "owner" && (
        <section className="panel padded">
          <h2>Exportar datos del despacho</h2>
          <p>
            Descarga una instantánea JSON de los registros comerciales,
            proyectos, obras, finanzas y recursos visibles. Incluye metadatos de
            los adjuntos. Los archivos binarios, las credenciales y las
            preferencias personales quedan fuera del archivo. El nombre contiene
            su huella SHA-256.
          </p>
          <form action="/api/exportacion">
            <label>
              Sección
              <select name="seccion">
                {Object.entries({
                  todo: "Todo el despacho",
                  comercial: "Comercial",
                  proyectos: "Proyectos",
                  obras: "Obras",
                  finanzas: "Finanzas",
                  recursos: "Recursos",
                }).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-primary">Descargar JSON</button>
          </form>
          <WorkspaceExportCheck />
        </section>
      )}
      {ctx?.membership?.role === "owner" && <LegacyReviewPanel />}
      {process.env.APP_ENV === "staging" &&
        ctx?.membership?.role === "owner" && (
          <StageLegacyPanel lines={ctx.lines} />
        )}
    </>
  );
}

import Link from "next/link";
import {
  canManageCommercial,
  canReadFinance,
  canWriteProject,
  type Role,
} from "@/shared/permissions";
export function QuickActions({ role }: { role: Role }) {
  if (!canWriteProject(role)) return null;
  const actions = [
    ...(canManageCommercial(role)
      ? [
          ["Nueva cotización", "/comercial/cotizaciones/nueva"],
          ["Nuevo cliente", "/comercial/clientes/nuevo"],
          ["Nueva oportunidad", "/comercial/pipeline?new=1"],
          ["Nuevo documento", "/recursos/documentos?new=1"],
        ]
      : []),
    ...(canReadFinance(role)
      ? [
          ["Nuevo proyecto", "/proyectos/nuevo"],
          [
            "Registrar obra",
            "/administracion/operaciones?crear=obra#nueva-obra",
          ],
          [
            "Registrar acuerdo de ingreso o costo",
            "/administracion/operaciones?crear=acuerdo#nuevo-acuerdo",
          ],
          ["Consultar cobros", "/administracion"],
        ]
      : []),
    ["Registrar pendiente", "/proyectos?crear=pendiente"],
    ["Registrar visita", "/proyectos?crear=visita"],
  ];
  return (
    <section className="panel padded" id="crear">
      <h2>Acciones rápidas</h2>
      <nav aria-label="Acciones rápidas" className="form-actions">
        {actions.map(([label, path]) => (
          <Link key={path} className="button button-outline" href={path}>
            {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}

import {
  canManageCommercial,
  canWriteProject,
  type Role,
} from "@/shared/permissions";

type Props = {
  scope: "client" | "project";
  role: Role;
  packages?: boolean;
  archived?: boolean;
};
export function DossierNav({
  scope,
  role,
  packages: hasPackages,
  archived,
}: Props) {
  const manager = canManageCommercial(role);
  const links: [string, string][] = [["ficha", "Ficha"]];
  if (scope === "client") {
    links.push(["contactos", "Contactos"]);
    if (manager) {
      links.push(
        ["acuerdos", "Acuerdos"],
        ["bitacora", "Historial"],
        ["archivos", "Archivos"],
      );
      if (!archived) links.push(["portal", "Acceso al portal"]);
    }
  } else {
    if (hasPackages) links.push(["paquetes", "Paquetes"]);
    links.push(
      ["fases", "Fases"],
      ["entregables", "Entregables"],
      ["pendientes", "Pendientes"],
      ["bitacora", "Bitácora"],
      ["archivos", "Archivos"],
    );
    if (canWriteProject(role)) links.push(["tiempo", "Tiempo"]);
    if (manager)
      links.push(
        ["cambios", "Cambios de alcance"],
        ["honorarios", "Honorarios"],
        ["rendimiento", "Rentabilidad"],
        ["cobros", "Cobros"],
      );
  }
  return (
    <nav aria-label="Secciones del expediente" className="dossier-nav">
      <strong>Ir a la sección</strong>
      <ul>
        {links.map(([id, label]) => (
          <li key={id}>
            <a href={"#" + id}>{label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

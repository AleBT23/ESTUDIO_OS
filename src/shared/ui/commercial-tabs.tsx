import Link from "next/link";
export function CommercialTabs({ active }: { active: string }) {
  return (
    <nav className="tabs" aria-label="Comercial">
      {[
        ["Clientes", "/comercial"],
        ["Catálogo", "/comercial/catalogo"],
        ["Conceptos", "/comercial/conceptos"],
        ["Presets", "/comercial/presets"],
        ["Cotizaciones", "/comercial/cotizaciones"],
        ["Contratos", "/comercial/contratos"],
      ].map(([label, href]) => (
        <Link
          key={href}
          className={active === href ? "selected" : ""}
          href={href}
        >
          {label}
        </Link>
      ))}
      <Link
        href="/comercial/pipeline"
        className={active === "/comercial/pipeline" ? "selected" : ""}
      >
        Pipeline
      </Link>
      <Link
        href="/comercial/marketing"
        className={active === "/comercial/marketing" ? "selected" : ""}
      >
        Marketing
      </Link>
    </nav>
  );
}

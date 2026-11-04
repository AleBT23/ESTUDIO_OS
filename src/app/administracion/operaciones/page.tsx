import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";
import { OperationForm } from "@/modules/finance/operation-form";

const areas = {
  architecture: "Proyecto arquitectónico",
  construction: "Obra",
  service: "Servicio complementario",
};
function Association({
  name,
  label,
  items,
}: {
  name: string;
  label: string;
  items: { id: string; name: string }[];
}) {
  return (
    <label>
      {label}
      <select name={name}>
        <option value="">Sin asociación</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export default async function Operations({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; page?: string }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p className="notice">Tu rol no permite consultar finanzas.</p>;
  const { area, page } = await searchParams;
  const org = ctx.organization.id,
    index = Math.max(1, Math.min(10000, parseInt(page ?? "1") || 1));
  let query = ctx.db
    .from("finance_case_balances")
    .select("*", { count: "exact" })
    .eq("organization_id", org)
    .order("created_at", { ascending: false })
    .order("id")
    .range((index - 1) * 30, index * 30 - 1);
  const selected = Object.hasOwn(areas, area ?? "") ? area : undefined;
  if (selected) query = query.eq("area", selected);
  const [cases, clients, projects, works, suppliers] = await Promise.all([
    query,
    ctx.db
      .from("clients")
      .select("id,name")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .order("name"),
    ctx.db
      .from("projects")
      .select("id,name")
      .eq("organization_id", org)
      .is("deleted_at", null)
      .order("name"),
    ctx.db
      .from("works")
      .select("id,name")
      .eq("organization_id", org)
      .order("name"),
    ctx.db
      .from("suppliers")
      .select("id,name")
      .eq("organization_id", org)
      .order("name"),
  ]);
  if (cases.error || clients.error || projects.error || works.error)
    return (
      <section className="panel padded">
        <h1>Operaciones financieras</h1>
        <p>
          No se pudieron cargar las operaciones. Verifica la conexión y la
          disponibilidad de la migración 012.
        </p>
        <Link href="/administracion">Abrir planes y cobros de proyectos</Link>
      </section>
    );
  const associations = (
    <>
      <Association name="client_id" label="Cliente" items={clients.data} />
      <Association name="project_id" label="Proyecto" items={projects.data} />
    </>
  );
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">ADMINISTRACIÓN</p>
        <h1>Operaciones financieras</h1>
        <p>
          Registra acuerdos nuevos en MXN. Los planes de proyectos ya
          contratados se cobran en{" "}
          <Link href="/administracion">Planes y cobros</Link>.
        </p>
        <Link href="/administracion/proveedores">
          Padrón de proveedores y subcontratistas
        </Link>
      </header>
      <nav className="tabs" aria-label="Área financiera">
        {Object.entries({ all: "Todas", ...areas }).map(([id, label]) => (
          <Link
            key={id}
            className={(selected ?? "all") === id ? "selected" : ""}
            href={id === "all" ? "?page=1" : "?area=" + id}
          >
            {label}
          </Link>
        ))}
      </nav>
      <section className="panel padded">
        <h2>Acuerdos y saldos</h2>
        {cases.data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Acuerdo",
                    "Área",
                    "Fondos",
                    "Por cobrar",
                    "Por pagar",
                    "Margen previsto",
                    "Flujo efectivo",
                  ].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.data.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={"/administracion/operaciones/" + r.id}>
                        {r.name}
                      </Link>
                    </td>
                    <td>{areas[r.area as keyof typeof areas]}</td>
                    <td>{r.managed ? "Del cliente" : "Propios"}</td>
                    <td>{formatMoney(r.receivable_cents)}</td>
                    <td>{formatMoney(r.payable_cents)}</td>
                    <td>
                      {r.managed
                        ? "No aplica"
                        : formatMoney(r.expected_margin_cents)}
                    </td>
                    <td>{formatMoney(r.cash_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No hay acuerdos en esta página.</p>
        )}
        <div className="form-actions">
          {index > 1 && (
            <Link href={"?area=" + (selected ?? "") + "&page=" + (index - 1)}>
              Anterior
            </Link>
          )}
          {index * 30 < (cases.count ?? 0) && (
            <Link href={"?area=" + (selected ?? "") + "&page=" + (index + 1)}>
              Siguiente
            </Link>
          )}
        </div>
      </section>
      <details>
        <summary>Registrar acuerdo de ingreso o costo</summary>
        <OperationForm kind="case" id={crypto.randomUUID()}>
          <label>
            Concepto
            <input name="name" required maxLength={160} />
          </label>
          <label>
            Área
            <select name="area" defaultValue={selected}>
              {Object.entries(areas).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {associations}
          {suppliers.data && (
            <Association
              name="supplier_id"
              label="Proveedor del padrón"
              items={suppliers.data}
            />
          )}
          <Association name="work_id" label="Obra" items={works.data} />
          <label>
            Nombre libre de proveedor
            <input name="provider" maxLength={160} />
          </label>
          <label>
            Ingreso acordado MXN
            <input
              type="number"
              min="0"
              step=".01"
              defaultValue="0"
              name="revenue_cents"
              required
            />
          </label>
          <label>
            Costo comprometido MXN
            <input
              type="number"
              min="0"
              step=".01"
              defaultValue="0"
              name="cost_cents"
              required
            />
          </label>
          <label>
            <input type="checkbox" name="managed" /> Recursos del cliente
            administrados para obra
          </label>
        </OperationForm>
      </details>
      <details>
        <summary>Registrar obra</summary>
        <OperationForm kind="work" id={crypto.randomUUID()}>
          <label>
            Nombre de la obra
            <input name="name" required maxLength={160} />
          </label>
          {associations}
        </OperationForm>
      </details>
    </>
  );
}

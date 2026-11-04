import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { OperationForm } from "@/modules/finance/operation-form";
export default async function Suppliers({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p className="notice">Permisos insuficientes.</p>;
  const q = await searchParams,
    term = (q.q ?? "").slice(0, 120),
    page = Math.max(1, Math.min(10000, parseInt(q.page ?? "1") || 1));
  let query = ctx.db
    .from("suppliers")
    .select("id,name,kind,contact", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .order("name")
    .order("id")
    .range((page - 1) * 30, page * 30 - 1);
  if (term)
    query = query.ilike("name", "%" + term.replace(/[\\%_]/g, "\\$&") + "%");
  const result = await query;
  const href = (n: number) => "?q=" + encodeURIComponent(term) + "&page=" + n;
  return (
    <>
      <header className="page-heading">
        <Link href="/administracion/operaciones">Operaciones financieras</Link>
        <h1>Proveedores y subcontratistas</h1>
      </header>
      <form className="search-form">
        <label>
          Buscar por nombre
          <input type="search" name="q" defaultValue={term} />
        </label>
        <button className="button button-outline">Buscar</button>
      </form>
      {result.error ? (
        <p className="notice">No se pudo consultar el padrón.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Contacto</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={"/administracion/proveedores/" + v.id}>
                        {v.name}
                      </Link>
                    </td>
                    <td>
                      {v.kind === "supplier" ? "Proveedor" : "Subcontratista"}
                    </td>
                    <td>{v.contact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!result.data.length && <p>Sin coincidencias.</p>}
          {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
          {page * 30 < (result.count ?? 0) && (
            <Link href={href(page + 1)}>Siguiente</Link>
          )}
        </>
      )}
      <details>
        <summary>Registrar proveedor o subcontratista</summary>
        <OperationForm id={crypto.randomUUID()} kind="supplier">
          <label>
            Nombre
            <input name="name" minLength={2} maxLength={160} required />
          </label>
          <label>
            Tipo
            <select name="kind">
              <option value="supplier">Proveedor</option>
              <option value="subcontractor">Subcontratista</option>
            </select>
          </label>
          <label>
            Contacto
            <input name="contact" maxLength={300} />
          </label>
        </OperationForm>
      </details>
    </>
  );
}

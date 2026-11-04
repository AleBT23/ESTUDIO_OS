import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { saveUsage } from "./resource-action";
const types = {
  material: "Material",
  labor: "Mano de obra",
  equipment: "Maquinaria y equipo",
};
export async function ResourceUsage({
  item,
  work,
  category,
  page,
}: {
  item: string;
  work: string;
  category?: string;
  page: number;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role)) return null;
  const filter = category && Object.hasOwn(types, category) ? category : "";
  let query = ctx.db
    .from("work_resource_usage")
    .select("id,description,unit,quantity,used_on,category,suppliers(name)", {
      count: "exact",
    })
    .eq("organization_id", ctx.organization.id)
    .eq("work_id", work)
    .eq("item_id", item)
    .order("used_on", { ascending: false })
    .order("id")
    .range((page - 1) * 30, page * 30 - 1);
  if (filter) query = query.eq("category", filter);
  const [rows, suppliers] = await Promise.all([
    query,
    ctx.db
      .from("suppliers")
      .select("id,name")
      .eq("organization_id", ctx.organization.id)
      .order("name"),
  ]);
  if (rows.error || suppliers.error)
    return (
      <p className="notice">
        No se pudieron consultar los consumos de la partida.
      </p>
    );
  const href = (c: string, n: number) =>
    "?recurso=" + c + "&consumos=" + n + "#consumos";
  return (
    <section className="panel padded" id="consumos">
      <h2>Consumos de la partida</h2>
      <nav className="tabs" aria-label="Tipo de recurso">
        {Object.entries({ "": "Todos", ...types }).map(([k, v]) => (
          <Link
            key={k}
            href={href(k, 1)}
            aria-current={k === filter ? "page" : undefined}
          >
            {v}
          </Link>
        ))}
      </nav>
      {rows.data.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {["Fecha", "Tipo", "Recurso", "Consumo", "Proveedor"].map(
                  (k) => (
                    <th key={k}>{k}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.data.map((r) => (
                <tr key={r.id}>
                  <td>{r.used_on}</td>
                  <td>{types[r.category as keyof typeof types]}</td>
                  <td>{r.description}</td>
                  <td>
                    {r.quantity} {r.unit}
                  </td>
                  <td>
                    {(r.suppliers as unknown as { name: string } | null)
                      ?.name ?? "Sin asignar"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Sin consumos en esta página.</p>
      )}
      {page > 1 && <Link href={href(filter, page - 1)}>Anterior </Link>}
      {page * 30 < (rows.count ?? 0) && (
        <Link href={href(filter, page + 1)}>Siguiente</Link>
      )}
      <details>
        <summary>Registrar consumo</summary>
        <RecordForm id={crypto.randomUUID()} save={saveUsage}>
          <input type="hidden" name="work_id" value={work} />
          <input type="hidden" name="item_id" value={item} />
          <label>
            Tipo
            <select name="category" defaultValue={filter || "material"}>
              {Object.entries(types).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Recurso utilizado
            <input name="description" required maxLength={200} />
          </label>
          <label>
            Fecha
            <input type="date" name="used_on" required />
          </label>
          <label>
            Cantidad
            <input
              type="number"
              name="quantity"
              step=".0001"
              min=".0001"
              required
            />
          </label>
          <label>
            Unidad
            <input
              name="unit"
              required
              placeholder="kg, horas, jornadas…"
              maxLength={30}
            />
          </label>
          <label>
            Proveedor
            <select name="supplier_id">
              <option value="">Sin asignar</option>
              {suppliers.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </RecordForm>
      </details>
    </section>
  );
}

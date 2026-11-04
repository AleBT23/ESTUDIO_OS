import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";

export async function ClientAgreements({
  id,
  page,
}: {
  id: string;
  page: number;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role)) return null;
  const result = await ctx.db
    .from("client_agreements")
    .select("id,name,area,managed,receivable,payable", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  const areas: Record<string, string> = {
    architecture: "Proyecto arquitectónico",
    construction: "Obra",
    service: "Servicio complementario",
  };
  const href = (n: number) => "?acuerdos=" + n + "#acuerdos";
  return (
    <section className="panel padded" id="acuerdos">
      <h2>Acuerdos financieros</h2>
      <Link href={"/administracion/reportes?customer=" + id}>
        Ver flujo y productividad del cliente
      </Link>
      {result.error ? (
        <p>No se pudieron consultar los acuerdos del cliente.</p>
      ) : (
        <>
          {result.data.length ? (
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
                    ].map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={"/administracion/operaciones/" + r.id}>
                          {r.name}
                        </Link>
                      </td>
                      <td>{areas[r.area]}</td>
                      <td>
                        {r.managed
                          ? "Administrados del cliente"
                          : "Propios del despacho"}
                      </td>
                      <td>{formatMoney(BigInt(r.receivable))}</td>
                      <td>{formatMoney(BigInt(r.payable))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin acuerdos en esta página.</p>
          )}
          {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
          {page * 20 < (result.count ?? 0) && (
            <Link href={href(page + 1)}>Siguiente</Link>
          )}
        </>
      )}
    </section>
  );
}

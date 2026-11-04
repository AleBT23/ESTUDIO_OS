import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { formatMoney } from "@/shared/money";

export default async function Supplier({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role))
    return <p>Permisos insuficientes.</p>;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const org = ctx.organization.id,
    page = Math.max(
      1,
      Math.min(10000, parseInt((await searchParams).page ?? "1") || 1),
    );
  const [supplier, totals, agreements] = await Promise.all([
    ctx.db
      .from("suppliers")
      .select("name,kind,contact")
      .eq("organization_id", org)
      .eq("id", id)
      .maybeSingle(),
    ctx.db
      .from("supplier_totals")
      .select("managed,cost,paid,payable")
      .eq("organization_id", org)
      .eq("supplier_id", id)
      .order("managed"),
    ctx.db
      .from("supplier_agreements")
      .select(
        "id,name,managed,cost:cost_cents::text,paid:paid_cents::text,payable:payable_cents::text",
        { count: "exact" },
      )
      .eq("organization_id", org)
      .eq("supplier_id", id)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 30, page * 30 - 1),
  ]);
  if (supplier.error || totals.error || agreements.error)
    throw Error("No se pudo cargar el estado de cuenta del proveedor.");
  if (!supplier.data) notFound();
  const money = (s: string) => formatMoney(BigInt(s));
  const funds = (managed: boolean) =>
    managed ? "Administrados del cliente" : "Propios del despacho";
  return (
    <>
      <Link href="/administracion/proveedores">Volver al padrón</Link>
      <header className="page-heading">
        <p className="eyebrow">
          {supplier.data.kind === "supplier" ? "PROVEEDOR" : "SUBCONTRATISTA"}
        </p>
        <h1>{supplier.data.name}</h1>
        <p>{supplier.data.contact}</p>
      </header>
      <section className="panel padded">
        <h2>Estado de cuenta</h2>
        <p>Importes en MXN de los acuerdos vinculados a este proveedor.</p>
        {totals.data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fondos</th>
                  <th>Comprometido</th>
                  <th>Pagado</th>
                  <th>Por pagar</th>
                </tr>
              </thead>
              <tbody>
                {totals.data.map((t) => (
                  <tr key={String(t.managed)}>
                    <th>{funds(t.managed)}</th>
                    <td>{money(t.cost)}</td>
                    <td>{money(t.paid)}</td>
                    <td>{money(t.payable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Sin acuerdos vinculados.</p>
        )}
      </section>
      <section className="panel padded">
        <h2>Acuerdos del proveedor</h2>
        {agreements.data.map((a) => (
          <article key={a.id} className="activity-row">
            <Link href={"/administracion/operaciones/" + a.id}>{a.name}</Link>
            <p>
              {funds(a.managed)} · Comprometido {money(a.cost)} · Pagado{" "}
              {money(a.paid)} · Por pagar {money(a.payable)}
            </p>
          </article>
        ))}
        {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
        {page * 30 < (agreements.count ?? 0) && (
          <Link href={"?page=" + (page + 1)}>Siguiente</Link>
        )}
      </section>
    </>
  );
}

export const metadata = { title: "Estado de cuenta del proveedor" };

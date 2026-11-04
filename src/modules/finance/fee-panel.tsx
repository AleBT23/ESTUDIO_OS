import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canReadFinance } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { formatMoney } from "@/shared/money";
import { saveFee } from "./fee-action";
export async function FeePanel({
  project,
  packages,
  page,
}: {
  project: string;
  packages: { id: string; name: string }[];
  page: number;
}) {
  const ctx = await requireContext();
  if (!canReadFinance(ctx.membership.role)) return null;
  const [members, fees] = await Promise.all([
    ctx.db
      .from("memberships")
      .select("user_id,role")
      .eq("organization_id", ctx.organization.id)
      .order("created_at"),
    ctx.db
      .from("collaborator_fees")
      .select("id,label,member_id,fixed_cents,rate_bps,base_cents", {
        count: "exact",
      })
      .eq("organization_id", ctx.organization.id)
      .eq("project_id", project)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 20, page * 20 - 1),
  ]);
  if (members.error || fees.error)
    return <p className="notice">No se pudieron consultar los honorarios.</p>;
  return (
    <section className="panel padded" id="honorarios">
      <h2>Honorarios de colaboradores</h2>
      {fees.data.length ? (
        fees.data.map((r) => (
          <p key={r.id}>
            <Link href={"/administracion/operaciones/" + r.id}>{r.label}</Link>{" "}
            ·{" "}
            {r.member_id === ctx.user.id
              ? "Mi cuenta"
              : "Miembro " + r.member_id.slice(0, 8)}{" "}
            ·{" "}
            {r.rate_bps
              ? r.rate_bps / 100 + "% de " + formatMoney(r.base_cents)
              : formatMoney(r.fixed_cents)}
          </p>
        ))
      ) : (
        <p>Sin honorarios en esta página.</p>
      )}
      {page > 1 && (
        <Link href={"?honorarios=" + (page - 1) + "#honorarios"}>
          Anterior{" "}
        </Link>
      )}
      {page * 20 < (fees.count ?? 0) && (
        <Link href={"?honorarios=" + (page + 1) + "#honorarios"}>
          Siguiente
        </Link>
      )}
      <details>
        <summary>Registrar honorario</summary>
        <RecordForm id={crypto.randomUUID()} save={saveFee}>
          <input type="hidden" name="project_id" value={project} />
          <label>
            Concepto
            <input name="label" minLength={2} maxLength={145} required />
          </label>
          <label>
            Colaborador
            <select name="member_id" required>
              {members.data.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id === ctx.user.id
                    ? "Mi cuenta"
                    : "Miembro " + m.user_id.slice(0, 8)}{" "}
                  · {m.role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Paquete
            <select name="package_id">
              <option value="">General del proyecto</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Regla
            <select name="mode">
              <option value="fixed">Importe fijo en MXN</option>
              <option value="percent">
                Porcentaje del neto contratado del paquete
              </option>
            </select>
          </label>
          <label>
            Importe o porcentaje
            <input type="number" name="value" min=".01" step=".01" required />
          </label>
        </RecordForm>
      </details>
    </section>
  );
}

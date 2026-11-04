import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { RecordForm } from "@/shared/ui/record-form";
import { issueInvitation, revokeInvitation } from "@/app/invitaciones/actions";
export default async function Invitations({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireContext();
  if (ctx.membership.role !== "owner")
    return <p>Solo el propietario puede invitar integrantes.</p>;
  const page = Math.max(
    1,
    Math.min(10000, parseInt((await searchParams).page || "1") || 1),
  );
  const result = await ctx.db
    .from("studio_invitation_history")
    .select("id,email,role,expires_at,status,expired", { count: "exact" })
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  const dates = new Intl.DateTimeFormat("es-MX", {
    timeZone: ctx.organization.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <>
      <Link href="/configuracion/equipo">Volver al equipo</Link>
      <h1>Invitaciones al estudio</h1>
      <p>
        Comparte el enlace a{" "}
        <Link href="/invitaciones">la bandeja de invitaciones</Link>. La persona
        debe entrar con el correo confirmado que indiques. Cada invitación vence
        a los siete días.
      </p>
      <details>
        <summary>Invitar integrante</summary>
        <RecordForm
          id={crypto.randomUUID()}
          save={issueInvitation}
          submitLabel="Crear invitación"
        >
          <label>
            Correo de la persona
            <input type="email" name="email" maxLength={254} required />
          </label>
          <label>
            Rol
            <select name="role" defaultValue="reader">
              <option value="reader">Lector</option>
              <option value="collaborator">Colaborador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
        </RecordForm>
      </details>
      <section className="panel padded">
        <h2>Historial de invitaciones</h2>
        {result.error ? (
          <p>No se pudo consultar el historial.</p>
        ) : (
          <>
            {!result.data.length && <p>Sin invitaciones en esta página.</p>}
            {result.data.map((i) => (
              <article className="activity-row" key={i.id}>
                <strong>{i.email}</strong>
                <p>
                  {i.role === "reader"
                    ? "Lector"
                    : i.role === "admin"
                      ? "Administrador"
                      : "Colaborador"}{" "}
                  ·{" "}
                  {i.status === "accepted"
                    ? "Aceptada"
                    : i.status === "revoked"
                      ? "Revocada"
                      : i.expired
                        ? "Vencida"
                        : "Pendiente"}{" "}
                  · Vencimiento {dates.format(new Date(i.expires_at))}
                </p>
                {i.status === "pending" && (
                  <RecordForm
                    id={i.id}
                    save={revokeInvitation}
                    submitLabel="Revocar invitación"
                  >
                    {null}
                  </RecordForm>
                )}
              </article>
            ))}
            {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
            {page * 25 < (result.count ?? 0) && (
              <Link href={"?page=" + (page + 1)}>Siguiente</Link>
            )}
          </>
        )}
      </section>
    </>
  );
}

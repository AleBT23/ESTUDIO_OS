import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { RecordForm } from "@/shared/ui/record-form";
import { changeRole } from "./action";
const labels: Record<string, string> = {
  owner: "Propietario",
  admin: "Administrador",
  collaborator: "Colaborador",
  reader: "Lector",
};
export default async function Team({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; history?: string }>;
}) {
  const ctx = await requireContext();
  if (ctx.membership.role !== "owner")
    return <p>Solo el propietario puede administrar el equipo.</p>;
  const q = await searchParams,
    history = q.history === "1",
    page = Math.max(1, Math.min(10000, parseInt(q.page || "1") || 1));
  const org = ctx.organization.id;
  const members = history
    ? null
    : await ctx.db
        .from("memberships")
        .select("user_id,role", { count: "exact" })
        .eq("organization_id", org)
        .order("created_at")
        .order("user_id")
        .range((page - 1) * 25, page * 25 - 1);
  const changes = history
    ? await ctx.db
        .from("member_role_changes")
        .select("id,member_id,old_role,new_role,actor_id,changed_at", {
          count: "exact",
        })
        .eq("organization_id", org)
        .order("changed_at", { ascending: false })
        .order("id")
        .range((page - 1) * 25, page * 25 - 1)
    : null;
  const name = (id: string) => (id === ctx.user.id ? "Mi cuenta" : id);
  const href = (p: number) =>
    "?history=" + (history ? "1" : "0") + "&page=" + p;
  const dates = new Intl.DateTimeFormat("es-MX", {
    timeZone: ctx.organization.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <>
      <Link href="/configuracion">Volver a configuración</Link>
      <header className="page-heading">
        <h1>Equipo del estudio</h1>
        <p>
          Los administradores gestionan información financiera y comercial. Los
          colaboradores registran trabajo; los lectores consultan información
          según sus permisos.
        </p>
      </header>
      <nav className="tabs">
        <Link href="?history=0">Miembros</Link>
        <Link href="?history=1">Historial de cambios</Link>
      </nav>
      {members?.error || changes?.error ? (
        <p>No se pudo consultar el equipo.</p>
      ) : (
        <section className="panel padded">
          {members?.data?.map((m) => (
            <article className="activity-row" key={m.user_id}>
              <strong>{name(m.user_id)}</strong>
              <p>{labels[m.role]}</p>
              {m.role !== "owner" && (
                <details>
                  <summary>Cambiar rol</summary>
                  <RecordForm
                    key={m.role}
                    id={m.user_id}
                    save={changeRole}
                    submitLabel="Aplicar cambio"
                  >
                    <input type="hidden" name="org" value={org} />
                    <input type="hidden" name="expected" value={m.role} />
                    <label>
                      Nuevo rol
                      <select name="desired" defaultValue="" required>
                        <option value="" disabled>
                          Elegir rol
                        </option>
                        {["admin", "collaborator", "reader"]
                          .filter((v) => v !== m.role)
                          .map((v) => (
                            <option key={v} value={v}>
                              {labels[v]}
                            </option>
                          ))}
                      </select>
                    </label>
                  </RecordForm>
                </details>
              )}
            </article>
          ))}
          {changes?.data?.map((c) => (
            <article className="activity-row" key={c.id}>
              <strong>{name(c.member_id)}</strong>
              <p>
                {labels[c.old_role]} → {labels[c.new_role]}
              </p>
              <small>
                {dates.format(new Date(c.changed_at))} · Registrado por{" "}
                {name(c.actor_id)}
              </small>
            </article>
          ))}
          {(members?.data ?? changes?.data)?.length === 0 && (
            <p>Sin registros en esta página.</p>
          )}
          {page > 1 && <Link href={href(page - 1)}>Anterior </Link>}
          {page * 25 < (members?.count ?? changes?.count ?? 0) && (
            <Link href={href(page + 1)}>Siguiente</Link>
          )}
        </section>
      )}
    </>
  );
}

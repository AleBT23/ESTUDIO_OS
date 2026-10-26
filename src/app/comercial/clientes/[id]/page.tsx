import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { ArchiveClientForm, ClientForm } from "@/modules/crm/client-form";
import type { Client } from "@/modules/crm/schema";
import { Button } from "@/shared/ui/button";
import { ClientContacts, type Contact } from "@/modules/crm/contacts";
export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;
  const { edit } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await ctx.db
    .from("clients")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el cliente.");
  if (!data) notFound();
  const client = data as Client;
  const canWrite = canManageCommercial(ctx.membership.role);
  const contacts = await ctx.db
    .from("client_contacts")
    .select("id,name,email,phone,position,version,deleted_at")
    .eq("organization_id", ctx.organization.id)
    .eq("client_id", id)
    .order("created_at")
    .limit(200);
  if (contacts.error) throw new Error("No se pudieron cargar los contactos.");
  const events = canWrite
    ? await ctx.db
        .from("audit_events")
        .select("id,action,created_at")
        .eq("organization_id", ctx.organization.id)
        .eq("entity_type", "clients")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(20)
    : null;
  if (events?.error) throw new Error("No se pudo cargar la actividad.");
  const labels: Record<string, string> = {
    created: "Cliente registrado",
    updated: "Información actualizada",
    archived: "Cliente archivado",
    restored: "Cliente restaurado",
  };
  return (
    <>
      <Link href="/comercial" className="back-link">
        ← Clientes
      </Link>
      <div className="page-heading">
        <p className="eyebrow">
          {client.kind === "company" ? "EMPRESA" : "PERSONA"} ·{" "}
          {client.deleted_at ? "ARCHIVADO" : "DIRECTORIO DEL ESTUDIO"}
        </p>
        <h1>{client.name}</h1>
        <p>
          {ctx.lines.find((l) => l.id === client.business_line_id)?.name ||
            "Ambas líneas / por definir"}
        </p>
      </div>
      {edit === "1" && canWrite && !client.deleted_at ? (
        <ClientForm client={client} lines={ctx.lines} />
      ) : (
        <div className="detail-layout">
          <section className="panel padded">
            <div className="section-heading">
              <h2>Información del cliente</h2>
              {canWrite && !client.deleted_at && (
                <Button asChild variant="outline">
                  <Link href={`/comercial/clientes/${id}?edit=1`}>Editar</Link>
                </Button>
              )}
            </div>
            <dl className="detail-list">
              {[
                ["Correo electrónico", client.email],
                ["Teléfono", client.phone],
                ["Dirección", client.address],
                ["Origen", client.source],
                ["Notas", client.notes],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Sin registrar"}</dd>
                </div>
              ))}
            </dl>
            {canWrite && (
              <div className="form-actions">
                <ArchiveClientForm client={client} />
              </div>
            )}
          </section>
          <section className="panel padded">
            <h2>Actividad</h2>
            {events?.data?.map((event) => (
              <div className="activity-row" key={event.id}>
                {labels[event.action] || event.action}
                <small>
                  {new Intl.DateTimeFormat("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: ctx.organization.timezone,
                  }).format(new Date(event.created_at))}
                </small>
              </div>
            ))}
            {!canWrite && (
              <p className="muted">
                El historial está disponible para administradores.
              </p>
            )}
            <p className="caption" style={{ marginTop: 20 }}>
              Versión {client.version}. El archivo conserva los datos del
              cliente.
            </p>
          </section>
        </div>
      )}
      {edit !== "1" && (
        <ClientContacts
          clientId={id}
          contacts={(contacts.data || []) as Contact[]}
          writable={canWrite && !client.deleted_at}
        />
      )}
    </>
  );
}

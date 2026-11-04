import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { RecordForm } from "@/shared/ui/record-form";
import { managePortal } from "./actions";
export async function PortalAccess({ client }: { client: string }) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role)) return null;
  const { data, error } = await ctx.db
    .from("client_portal_access")
    .select("user_id,enabled")
    .eq("organization_id", ctx.organization.id)
    .eq("client_id", client)
    .order("created_at");
  if (error)
    return <p className="notice">No se pudo consultar el acceso al portal.</p>;
  return (
    <section id="portal" className="panel padded">
      <h2>Acceso al portal de clientes</h2>
      <p>
        El cliente puede consultar su identificador de cuenta al entrar al{" "}
        <Link href="/portal">portal</Link>. Vincúlalo aquí para habilitar sus
        entregas publicadas.
      </p>
      <details>
        <summary>Vincular cuenta</summary>
        <RecordForm
          id={crypto.randomUUID()}
          save={managePortal.bind(null, "grant")}
        >
          <input type="hidden" name="client_id" value={client} />
          <label>
            Identificador de cuenta
            <input name="user_id" required />
          </label>
        </RecordForm>
      </details>
      {data.map((row) => (
        <details key={row.user_id}>
          <summary>
            {row.enabled ? "Habilitada" : "Revocada"} · {row.user_id}
          </summary>
          <RecordForm
            save={managePortal.bind(null, row.enabled ? "revoke" : "enable")}
            id={crypto.randomUUID()}
          >
            <input type="hidden" name="client_id" value={client} />
            <input type="hidden" name="user_id" value={row.user_id} />
            <p>
              {row.enabled
                ? "Revocar acceso de esta cuenta"
                : "Habilitar acceso de esta cuenta"}
            </p>
          </RecordForm>
        </details>
      ))}
    </section>
  );
}
export async function PublishDelivery({
  project,
  delivery,
}: {
  project: string;
  delivery: string;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role)) return null;
  const { data, error } = await ctx.db
    .from("portal_deliveries")
    .select("id,visible")
    .eq("organization_id", ctx.organization.id)
    .eq("deliverable_id", delivery)
    .maybeSingle();
  if (error) return <p className="notice">Publicación no disponible.</p>;
  return (
    <details>
      <summary>
        {data
          ? data.visible
            ? "Retirar del portal"
            : "Volver a publicar"
          : "Publicar en el portal del cliente"}
      </summary>
      {data ? (
        <RecordForm
          id={crypto.randomUUID()}
          save={managePortal.bind(null, "visibility")}
        >
          <input type="hidden" name="publication_id" value={data.id} />
          <input type="hidden" name="visible" value={String(!data.visible)} />
          <p>
            {data.visible
              ? "Retirar la entrega del portal del cliente."
              : "Habilitar de nuevo esta entrega en el portal."}
          </p>
        </RecordForm>
      ) : (
        <RecordForm
          id={crypto.randomUUID()}
          save={managePortal.bind(null, "publish")}
        >
          <input type="hidden" name="project_id" value={project} />
          <input type="hidden" name="deliverable_id" value={delivery} />
          <label>
            Enlace al archivo autorizado para el cliente
            <input
              name="resource_url"
              type="url"
              placeholder="https://"
              maxLength={2000}
              required
            />
          </label>
        </RecordForm>
      )}
    </details>
  );
}

"use client";
import { useActionState } from "react";
import { Button } from "@/shared/ui/button";
import { saveContact, archiveContact } from "./contact-actions";
export type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  version: number;
  deleted_at: string | null;
};
function ContactForm({
  clientId,
  contact,
}: {
  clientId: string;
  contact?: Contact;
}) {
  const [state, action, pending] = useActionState(saveContact, {});
  return (
    <form action={action} className="form-stack">
      <input type="hidden" name="client_id" value={clientId} />
      {contact && (
        <>
          <input type="hidden" name="id" value={contact.id} />
          <input type="hidden" name="version" value={contact.version} />
        </>
      )}
      <div className="form-grid">
        <label>
          Nombre *
          <input
            name="name"
            required
            minLength={2}
            maxLength={160}
            defaultValue={contact?.name}
          />
        </label>
        <label>
          Cargo o relación
          <input
            name="position"
            maxLength={120}
            defaultValue={contact?.position}
          />
        </label>
        <label>
          Correo
          <input
            name="email"
            type="email"
            maxLength={254}
            defaultValue={contact?.email}
          />
        </label>
        <label>
          Teléfono
          <input
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={contact?.phone}
          />
        </label>
      </div>
      <Button disabled={pending}>
        {pending ? "Guardando…" : "Guardar contacto"}
      </Button>
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="notice success" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}
function ArchiveContactForm({
  clientId,
  contact,
}: {
  clientId: string;
  contact: Contact;
}) {
  const [state, action, pending] = useActionState(archiveContact, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={contact.id} />
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="version" value={contact.version} />
      <input
        type="hidden"
        name="intent"
        value={contact.deleted_at ? "restore" : "archive"}
      />
      <Button variant="ghost" disabled={pending}>
        {pending
          ? "Actualizando…"
          : contact.deleted_at
            ? "Restaurar contacto"
            : "Archivar contacto"}
      </Button>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
    </form>
  );
}
export function ClientContacts({
  clientId,
  contacts,
  writable,
}: {
  clientId: string;
  contacts: Contact[];
  writable: boolean;
}) {
  return (
    <section className="panel padded" style={{ marginTop: 24 }}>
      <h2>Personas de contacto</h2>
      {contacts
        .filter((c) => !c.deleted_at)
        .map((contact) => (
          <div className="contact-row" key={contact.id}>
            <h3>{contact.name}</h3>
            <p className="muted">
              {[contact.position, contact.email, contact.phone]
                .filter(Boolean)
                .join(" · ") || "Sin información adicional"}
            </p>
            {writable && (
              <>
                <details>
                  <summary className="text-link">Editar contacto</summary>
                  <ContactForm clientId={clientId} contact={contact} />
                </details>
                <ArchiveContactForm clientId={clientId} contact={contact} />
              </>
            )}
          </div>
        ))}
      {!contacts.some((c) => !c.deleted_at) && (
        <p className="muted">
          Agrega las personas que participan en esta relación.
        </p>
      )}
      {writable && (
        <>
          <details>
            <summary className="text-link">Agregar contacto +</summary>
            <ContactForm clientId={clientId} />
          </details>
          {contacts.some((c) => c.deleted_at) && (
            <details>
              <summary className="text-link">Contactos archivados</summary>
              {contacts
                .filter((c) => c.deleted_at)
                .map((contact) => (
                  <div key={contact.id}>
                    <span>{contact.name}</span>
                    <ArchiveContactForm clientId={clientId} contact={contact} />
                  </div>
                ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}

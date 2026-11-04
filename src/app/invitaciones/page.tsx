import Link from "next/link";
import { getContext } from "@/shared/auth/context";
import { isConfigured } from "@/shared/db/server";
import { LoginForm } from "@/shared/ui/auth-forms";
import { SignupForm } from "@/shared/ui/signup-form";
import { RecordForm } from "@/shared/ui/record-form";
import { acceptInvitation } from "./actions";
export default async function Inbox() {
  if (!isConfigured())
    return <p>Las invitaciones requieren conexión con el estudio.</p>;
  const ctx = await getContext();
  if (!ctx)
    return (
      <section className="panel padded">
        <h1>Acceder con invitación</h1>
        <p>
          Usa el mismo correo que registró el propietario. Si es tu primera vez,
          crea una cuenta y confirma tu correo.
        </p>
        <LoginForm invitation />
        <details>
          <summary>Crear cuenta para aceptar una invitación</summary>
          <SignupForm />
        </details>
      </section>
    );
  if (ctx.membership)
    return (
      <section className="panel padded">
        <h1>Mi estudio</h1>
        <p>Tu cuenta ya pertenece a {ctx.organization?.name}.</p>
        <Link href="/">Abrir el estudio</Link>
      </section>
    );
  const { data, error } = await ctx.db.rpc("my_studio_invitations");
  return (
    <section className="panel padded">
      <h1>Mis invitaciones</h1>
      <p>{ctx.user.email}</p>
      {error ? (
        <p>No se pudieron consultar las invitaciones.</p>
      ) : data?.length ? (
        data.map(
          (i: {
            id: string;
            studio: string;
            role: string;
            expires_at: string;
          }) => (
            <article key={i.id}>
              <h2>{i.studio}</h2>
              <p>
                Rol ofrecido ·{" "}
                {i.role === "reader"
                  ? "Lector"
                  : i.role === "admin"
                    ? "Administrador"
                    : "Colaborador"}
              </p>
              <RecordForm
                id={i.id}
                save={acceptInvitation}
                submitLabel="Aceptar y entrar"
              >
                {null}
              </RecordForm>
            </article>
          ),
        )
      ) : (
        <p>
          Sin invitaciones vigentes. Comprueba que hayas confirmado tu correo.
        </p>
      )}
    </section>
  );
}

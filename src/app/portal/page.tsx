import { SignupForm } from "@/shared/ui/signup-form";
import Link from "next/link";
import { database, isConfigured } from "@/shared/db/server";
import { LoginForm } from "@/shared/ui/auth-forms";
import { signOut } from "@/shared/auth/actions";
export default async function Portal({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!isConfigured())
    return <p className="notice">El portal está pendiente de conexión.</p>;
  const db = await database(),
    {
      data: { user },
    } = await db.auth.getUser();
  if (!user)
    return (
      <section className="panel padded">
        <h1>Portal de clientes</h1>
        <p>
          Accede con tu cuenta para ver las entregas que el estudio ha
          publicado.
        </p>
        <LoginForm portal />
        <details>
          <summary>Crear cuenta de cliente</summary>
          <SignupForm />
        </details>
      </section>
    );
  const page = Math.max(
    1,
    Math.min(10000, parseInt((await searchParams).page ?? "1") || 1),
  );
  const { data, error, count } = await db
    .from("my_portal_deliveries")
    .select("id,title,project_name,resource_url,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">ESTUDIO OS</p>
        <h1>Portal de clientes</h1>
        <p>{user.email}</p>
        <form action={signOut}>
          <button className="button button-outline">Cerrar sesión</button>
        </form>
      </header>
      <section className="panel padded">
        <h2>Mis entregas</h2>
        {error ? (
          <p>No se pudieron consultar las entregas.</p>
        ) : data.length ? (
          data.map((r) => (
            <article key={r.id} className="activity-row">
              <strong>
                {r.project_name} · {r.title}
              </strong>
              <a href={r.resource_url} target="_blank" rel="noreferrer">
                Abrir entrega
              </a>
            </article>
          ))
        ) : (
          <p>No hay entregas publicadas en esta página.</p>
        )}
        {page > 1 && <Link href={"?page=" + (page - 1)}>Anterior </Link>}
        {page * 20 < (count ?? 0) && (
          <Link href={"?page=" + (page + 1)}>Siguiente</Link>
        )}
      </section>
      <details>
        <summary>Identificador para vincular mi cuenta</summary>
        <p>
          Comparte este identificador con el estudio para que pueda darte acceso
          a tus entregas.
        </p>
        <code>{user.id}</code>
      </details>
    </>
  );
}

export const metadata = { title: "Portal de clientes" };

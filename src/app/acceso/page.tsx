import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/shared/auth/context";
import { isConfigured } from "@/shared/db/server";
import { LoginForm } from "@/shared/ui/auth-forms";
import { studioDestination } from "@/shared/auth/destination";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ volver?: string }>;
}) {
  const volver = studioDestination((await searchParams).volver);
  if (await getContext()) redirect(volver);
  return (
    <div className="auth-card panel">
      <Image
        src="/marca/logo-ab.png"
        alt="Alejandro Barajas Arquitectura"
        width={270}
        height={90}
        className="auth-logo"
      />
      <p className="eyebrow">BIENVENIDO A TU ESPACIO</p>
      <h1>Todo comienza aquí.</h1>
      <p className="muted">
        Entra para continuar con el trabajo de tu estudio.
      </p>
      {isConfigured() ? (
        <>
          <LoginForm volver={volver} />
          <Link href="/invitaciones">
            Entrar con una invitación del estudio
          </Link>
        </>
      ) : (
        <div className="notice">
          El estudio aún no está conectado.{" "}
          <Link href="/configuracion">Ver pasos de configuración →</Link>
        </div>
      )}
    </div>
  );
}

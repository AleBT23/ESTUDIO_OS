import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getContext } from "@/shared/auth/context";
import { isConfigured } from "@/shared/db/server";
import { LoginForm } from "@/shared/ui/auth-forms";
export default async function LoginPage() {
  if (await getContext()) redirect("/");
  return (
    <div className="auth-card panel">
      <Image
        src="/marca/logo.png"
        alt="Alejandro Torres Arquitectura"
        width={270}
        height={108}
        className="auth-logo"
      />
      <p className="eyebrow">BIENVENIDO A TU ESPACIO</p>
      <h1>Todo comienza aquí.</h1>
      <p className="muted">
        Entra para continuar con el trabajo de tu estudio.
      </p>
      {isConfigured() ? (
        <LoginForm />
      ) : (
        <div className="notice">
          El estudio aún no está conectado.{" "}
          <Link href="/configuracion">Ver pasos de configuración →</Link>
        </div>
      )}
    </div>
  );
}

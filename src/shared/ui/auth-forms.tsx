"use client";
import { useActionState } from "react";
import { signIn, createWorkspace } from "@/shared/auth/actions";
import { Button } from "./button";
export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action} className="form-stack">
      <label>
        Correo electrónico
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label>
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          maxLength={128}
        />
      </label>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
      <Button disabled={pending}>
        {pending ? "Entrando…" : "Entrar al estudio"}
      </Button>
    </form>
  );
}
export function WorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspace, {});
  return (
    <form action={action} className="form-stack">
      <label>
        Nombre del estudio
        <input name="name" required minLength={2} maxLength={120} />
      </label>
      {state.error && (
        <p role="alert" className="notice error">
          {state.error}
        </p>
      )}
      <Button disabled={pending}>
        {pending ? "Creando…" : "Crear mi espacio"}
      </Button>
    </form>
  );
}

import { RecordForm } from "./record-form";
import { requestAccount } from "@/shared/auth/signup-action";
export function SignupForm() {
  return (
    <RecordForm
      id={crypto.randomUUID()}
      save={requestAccount}
      submitLabel="Crear cuenta"
    >
      <label>
        Correo electrónico
        <input type="email" autoComplete="email" required name="email" />
      </label>
      <label>
        Contraseña de al menos 12 caracteres
        <input
          type="password"
          name="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
    </RecordForm>
  );
}

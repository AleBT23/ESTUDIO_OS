import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { ClientForm } from "@/modules/crm/client-form";
export default async function NewClientPage() {
  const ctx = await requireContext();
  return (
    <>
      <Link href="/comercial" className="back-link">
        ← Clientes
      </Link>
      <div className="page-heading">
        <p className="eyebrow">UNA NUEVA CONVERSACIÓN</p>
        <h1>Nuevo cliente</h1>
        <p>Comienza con un nombre. Los detalles pueden llegar después.</p>
      </div>
      {canManageCommercial(ctx.membership.role) ? (
        <ClientForm lines={ctx.lines} />
      ) : (
        <p className="notice" role="alert">
          Tu rol permite consultar clientes. Solicita a un administrador que
          registre este cliente.
        </p>
      )}
    </>
  );
}

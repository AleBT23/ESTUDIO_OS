import { requireContext } from "@/shared/auth/context";
import {
  PaymentForm,
  type PaymentProps,
  type PackageOption,
} from "./payment-forms";

export async function SchedulePaymentForm(props: PaymentProps) {
  const ctx = await requireContext();
  const { data, error } = props.plans.length
    ? await ctx.db.rpc("schedule_package_options", {
        org: ctx.organization.id,
        schedules: props.plans.map((plan) => plan.id),
      })
    : { data: [], error: null };
  const options: Record<string, PackageOption[]> = Object.fromEntries(
    (data ?? []).map(
      (row: { schedule_id: string; options: PackageOption[] }) => [
        row.schedule_id,
        row.options,
      ],
    ),
  );
  return (
    <>
      {error && (
        <p className="notice">
          No se pudieron cargar los paquetes. Los cobros registrados desde este
          formulario quedarán sin asignar.
        </p>
      )}
      <PaymentForm {...props} packageOptions={options} />
    </>
  );
}

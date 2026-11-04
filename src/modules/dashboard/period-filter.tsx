import { cookies } from "next/headers";
import { requireContext } from "@/shared/auth/context";
import { RecordForm } from "@/shared/ui/record-form";
import { cashFilter } from "./cash-filter";
import { setCashFilter } from "./cash-filter-action";
export async function dashboardFilter() {
  const ctx = await requireContext();
  const stored = (await cookies()).get(
    "studio-flow-" + ctx.organization.id + "-" + ctx.user.id,
  )?.value;
  return (
    cashFilter(Object.fromEntries(new URLSearchParams(stored)), ctx.lines) ?? {
      from_date: "",
      to_date: "",
      line: "",
    }
  );
}
export function PeriodFilter({
  values,
  lines,
}: {
  values: Awaited<ReturnType<typeof dashboardFilter>>;
  lines: { id: string; name: string }[];
}) {
  return (
    <details
      className="panel padded"
      open={Boolean(values.from_date || values.to_date || values.line)}
    >
      <summary>Filtrar indicadores y flujo por periodo y línea</summary>
      <p>
        Se usa la fecha de inicio del proyecto, el envío de la propuesta, el
        vencimiento de la tarea o entrega y la fecha efectiva del movimiento. Un
        proyecto con varios paquetes de la línea se cuenta una vez.
      </p>{" "}
      <RecordForm
        key={new URLSearchParams(values).toString()}
        id="dashboard-flow"
        save={setCashFilter}
      >
        <label>
          Desde
          <input type="date" name="from_date" defaultValue={values.from_date} />
        </label>
        <label>
          Hasta
          <input type="date" name="to_date" defaultValue={values.to_date} />
        </label>
        <label>
          Línea
          <select name="line" defaultValue={values.line}>
            <option value="">Todas las líneas</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </RecordForm>
    </details>
  );
}

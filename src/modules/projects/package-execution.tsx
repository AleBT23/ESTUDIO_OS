import Link from "next/link";
import { formatMoney } from "@/shared/money";

export type PackageExecutionRow = {
  package_id: string | null;
  package_name: string;
  contracted: string | null;
  received: string;
  paid: string;
  managed_received: string;
  managed_paid: string;
  minutes: string;
};

export function PackageExecution({
  rows,
  project,
}: {
  rows: PackageExecutionRow[];
  project: string;
}) {
  if (!rows.length) return <p>Sin paquetes ni ejecución registrada.</p>;
  const money = (amount: string) => formatMoney(BigInt(amount));
  return (
    <div className="table-scroll">
      <table>
        <caption>Presupuesto y ejecución por paquete</caption>
        <thead>
          <tr>
            {[
              "Paquete",
              "Contrato sin IVA",
              "Cobros propios",
              "Pagos propios",
              "Flujo propio",
              "Fondos de obra recibidos",
              "Fondos de obra ejercidos",
              "Minutos trabajados",
            ].map((title) => (
              <th scope="col" key={title}>
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.package_id ?? "unassigned"}>
              <th scope="row">
                {row.package_id ? (
                  <Link
                    href={`/administracion/reportes?project=${project}&package=${row.package_id}`}
                  >
                    {row.package_name}
                  </Link>
                ) : (
                  row.package_name
                )}
              </th>
              <td>
                {row.contracted === null
                  ? "Sin presupuesto asignado"
                  : money(row.contracted)}
              </td>
              <td>{money(row.received)}</td>
              <td>{money(row.paid)}</td>
              <td>{formatMoney(BigInt(row.received) - BigInt(row.paid))}</td>
              <td>{money(row.managed_received)}</td>
              <td>{money(row.managed_paid)}</td>
              <td>{row.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

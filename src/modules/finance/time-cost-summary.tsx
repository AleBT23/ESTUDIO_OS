import Link from "next/link";
import { formatMoney } from "@/shared/money";
export type TimeCost = {
  rated_minutes: string;
  unrated_minutes: string;
  estimated_cost: string;
};
export function TimeCostSummary({ row }: { row: TimeCost }) {
  return (
    <section className="panel padded">
      <h3>Costo imputado de horas internas</h3>
      <p>
        {formatMoney(BigInt(row.estimated_cost))} por {row.rated_minutes}{" "}
        minutos con tarifa.
      </p>
      {BigInt(row.unrated_minutes) > 0n && (
        <p className="notice">
          Estimación parcial. Faltan tarifas para {row.unrated_minutes} minutos.
        </p>
      )}
      <p>
        Se suman los minutos por su tarifa vigente y se divide entre 60. El
        flujo de efectivo se calcula por separado.
      </p>
      <Link href="/administracion/tarifas">Consultar tarifas por miembro</Link>
    </section>
  );
}

import { RecordForm } from "@/shared/ui/record-form";
import { replanSchedule } from "./actions";
export function ReplanForm({
  plan,
}: {
  plan: {
    id: string;
    due_date: string;
    amount_text: string;
    balance_text: string;
  };
}) {
  return (
    <details>
      <summary>Reprogramar saldo</summary>
      <RecordForm
        key={plan.due_date + "-" + plan.balance_text}
        id={crypto.randomUUID()}
        save={replanSchedule}
        submitLabel="Actualizar plan"
      >
        <input type="hidden" name="schedule" value={plan.id} />
        <input type="hidden" name="expected_due" value={plan.due_date} />
        <input type="hidden" name="expected_amount" value={plan.amount_text} />
        <input
          type="hidden"
          name="expected_balance"
          value={plan.balance_text}
        />
        <label>
          Importe a reprogramar en MXN
          <input type="number" min="0.01" step="0.01" name="amount" required />
        </label>
        <label>
          Nueva fecha de cobro
          <input type="date" name="new_due" required />
        </label>
        <p>
          Para dividir el saldo, indica solo el importe que vence en la nueva
          fecha.
        </p>
      </RecordForm>
    </details>
  );
}

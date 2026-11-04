import { RecordForm } from "@/shared/ui/record-form";
import { addSubtask, saveSubtask } from "./subtask-action";
export function Subtasks({
  task,
  project,
  items,
  writable,
}: {
  task: string;
  project: string;
  items: { id: string; label: string; done: boolean }[];
  writable: boolean;
}) {
  return (
    <details>
      <summary>
        Subtareas · {items.filter((i) => i.done).length}/{items.length}
      </summary>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            {i.label} · {i.done ? "Completa" : "Pendiente"}
            {writable && (
              <form
                action={saveSubtask.bind(null, project, task, i.id, !i.done)}
              >
                <button className="button button-outline">
                  {i.done ? "Reabrir subtarea" : "Completar subtarea"}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {writable && (
        <RecordForm
          id={crypto.randomUUID()}
          save={addSubtask.bind(null, project, task)}
        >
          <label>
            Nueva subtarea
            <input name="label" required maxLength={400} />
          </label>
        </RecordForm>
      )}
    </details>
  );
}


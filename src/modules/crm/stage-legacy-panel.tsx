import { RecordForm } from "@/shared/ui/record-form";
import { stageLegacyClients } from "./stage-legacy-clients";
export function StageLegacyPanel() {
  return (
    <details className="panel padded">
      <summary>Importar clientes al directorio de staging</summary>
      <p>
        La operación incorpora los clientes de la exportación a este estudio de
        prueba. Una coincidencia ambigua cancela el lote completo.
      </p>
      <RecordForm
        id="legacy-client-stage"
        save={stageLegacyClients}
        submitLabel="Importar clientes a staging"
      >
        <label>
          Exportación verificada
          <input
            type="file"
            name="file"
            accept=".json,application/json"
            required
          />
        </label>
        <label>
          Tipo de los clientes de este lote
          <select name="kind" defaultValue="" required>
            <option value="">Seleccionar tipo</option>
            <option value="person">Personas</option>
            <option value="company">Empresas</option>
          </select>
        </label>
      </RecordForm>
    </details>
  );
}

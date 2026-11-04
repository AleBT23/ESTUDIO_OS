import { stageLegacyService, stageLegacyPreset } from "./stage-legacy-service";
import { RecordForm } from "@/shared/ui/record-form";
import { stageLegacyClients } from "./stage-legacy-clients";
export function StageLegacyPanel({
  lines,
}: {
  lines: { id: string; name: string }[];
}) {
  return (
    <>
      <details className="panel padded">
        <summary>Importar clientes al directorio de staging</summary>
        <p>
          La operación incorpora los clientes de la exportación a este estudio
          de prueba. Una coincidencia ambigua cancela el lote completo.
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
      <details className="panel padded">
        <summary>Importar un servicio al catálogo de staging</summary>
        <p>
          Selecciona la línea del servicio en una exportación en MXN. Se
          conserva el estado activo o archivado y la tarifa histórica.
        </p>
        <RecordForm
          id="stage-service"
          save={stageLegacyService}
          submitLabel="Importar servicio a staging"
        >
          <label>
            Exportación JSON
            <input type="file" name="file" accept=".json" required />
          </label>
          <label>
            Identificador original del servicio
            <input name="legacy_id" required maxLength={160} />
          </label>
          <label>
            Línea de destino
            <select name="line" defaultValue="" required>
              <option value="">Seleccionar línea</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </RecordForm>
      </details>
      <details className="panel padded">
        <summary>Importar un preset de servicios a staging</summary>
        <p>
          Importa primero los servicios del preset. Se conserva su orden y se
          asigna una unidad por partida.
        </p>
        <RecordForm
          id="stage-preset"
          save={stageLegacyPreset}
          submitLabel="Importar preset a staging"
        >
          <label>
            Exportación JSON
            <input type="file" accept=".json" name="file" required />
          </label>
          <label>
            Identificador original del preset
            <input name="legacy_id" required maxLength={160} />
          </label>
        </RecordForm>
      </details>
    </>
  );
}

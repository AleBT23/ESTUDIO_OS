"use client";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { sectionLabels, type DocumentOptions } from "./schema";
export type LayoutImage = {
  id: string;
  title: string;
  filename: string;
  version: number;
};
export function LayoutEditor({
  options,
  setOptions,
  images,
  imageError,
}: {
  options: DocumentOptions;
  setOptions: (options: DocumentOptions) => void;
  images: LayoutImage[];
  imageError: boolean;
}) {
  function move(index: number, delta: number) {
    const list = [...options.sections];
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    setOptions({ ...options, sections: list });
  }
  return (
    <div className="settings-grid">
      <div>
        <h3>Secciones y orden</h3>
        {Object.entries(sectionLabels)
          .filter(
            ([key]) =>
              !options.sections.includes(
                key as DocumentOptions["sections"][number],
              ),
          )
          .map(([key, label]) => (
            <Button
              key={key}
              type="button"
              variant="ghost"
              onClick={() => {
                setOptions({
                  ...options,
                  sections: [
                    ...options.sections,
                    key as DocumentOptions["sections"][number],
                  ],
                });
              }}
            >
              + {label}
            </Button>
          ))}
        <ol className="document-sections">
          {options.sections.map((section, index) => (
            <li key={section}>
              <span>{sectionLabels[section]}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Subir ${sectionLabels[section]}`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Bajar ${sectionLabels[section]}`}
                disabled={index === options.sections.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={14} />
              </button>
              {section !== "budget" && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    setOptions({
                      ...options,
                      sections: options.sections.filter((s) => s !== section),
                    });
                  }}
                  aria-label={`Quitar ${sectionLabels[section]}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div>
        <label>
          Membrete de la cotización
          <select
            value={options.letterhead_revision ?? ""}
            onChange={(e) => {
              setOptions({
                ...options,
                letterhead_revision: e.target.value || undefined,
              });
            }}
          >
            <option value="">Oficial del despacho</option>
            {images.map((i) => (
              <option value={i.id} key={i.id}>
                {i.title} · v{i.version} · {i.filename}
              </option>
            ))}
          </select>
        </label>
        {imageError && <p>No se pudo cargar la biblioteca de membretes.</p>}
        <h3>Márgenes del membrete · mm</h3>
        <div className="form-grid">
          {(
            [
              ["top", "Superior", 32, 60],
              ["bottom", "Inferior", 26, 60],
              ["left", "Izquierdo", 12, 45],
              ["right", "Derecho", 24, 50],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min={min}
                max={max}
                required
                step="0.5"
                value={options.margins[key]}
                onChange={(e) => {
                  setOptions({
                    ...options,
                    margins: {
                      ...options.margins,
                      [key]: Number(e.target.value),
                    },
                  });
                }}
              />
            </label>
          ))}
        </div>
        <p className="caption" style={{ marginTop: 14 }}>
          Carta 215.9 × 279.4 mm. Los mínimos reservan logotipo, ornamento
          lateral y datos inferiores del PNG oficial.
        </p>
      </div>
    </div>
  );
}

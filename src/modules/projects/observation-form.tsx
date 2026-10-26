"use client";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  prepareObservation,
  finishObservation,
  cancelObservation,
} from "./photo-actions";
import { uploadPreparedPhotos } from "./photo-upload";
import { browserDatabase } from "@/shared/db/browser";
import type { PreparedObservation, ObservationResult } from "./photo-contract";
import { Status } from "./forms";
async function prepare(file: File) {
  if (file.size > 30 * 1024 * 1024)
    throw Error("La foto es demasiado grande. Elige una versión más pequeña.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(
          Error(
            "No se pudo abrir la foto. Expórtala como JPEG desde Fotos y vuelve a elegirla.",
          ),
        );
      img.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight)
      throw Error("Fotografía no válida.");
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw Error("No se pudo preparar la foto en este dispositivo.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(Error("No se pudo convertir la foto.")),
        "image/jpeg",
        0.82,
      ),
    );
    if (blob.size > 2097152)
      throw Error(
        "La fotografía todavía es demasiado grande. Prueba con una versión menor.",
      );
    return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function ObservationForm({
  project,
  today,
  requestId,
}: {
  project: string;
  today: string;
  requestId: string;
}) {
  const [photos, setPhotos] = useState<File[]>([]),
    [preparing, setPreparing] = useState(false),
    [photoError, setPhotoError] = useState(""),
    [body, setBody] = useState("");
  const [observedOn, setObservedOn] = useState(today);
  const currentRequest = useRef(requestId);
  const currentPlan = useRef<PreparedObservation | null>(null);
  const preparedForm = useRef<FormData | null>(null);
  const [draft, setDraft] = useState(false);
  const [progress, setProgress] = useState("");
  const [state, action, pending] = useActionState(
    async (
      _prev: ObservationResult,
      form: FormData,
    ): Promise<ObservationResult> => {
      setPhotoError("");
      const complete = (result: ObservationResult, discard = false) => {
        if (result.success && result.nextRequestId) {
          currentRequest.current = result.nextRequestId;
          currentPlan.current = null;
          preparedForm.current = null;
          setDraft(false);
          if (!discard || result.published) {
            setPhotos([]);
            setBody("");
          }
        }
        return result;
      };
      try {
        if (form.get("intent") === "discard")
          return complete(
            await cancelObservation(currentRequest.current),
            true,
          );
        if (currentPlan.current) {
          // Comprueba primero una publicación cuya respuesta pudo perderse.
          const previous = await finishObservation(
            currentPlan.current.observation,
          );
          if (previous.success) return complete(previous);
        } else {
          preparedForm.current ??= form;
          setDraft(true);
          const prepared = await prepareObservation(
            preparedForm.current,
            photos.map((file) => ({ type: file.type, size: file.size })),
            currentRequest.current,
          );
          if (!prepared.plan) {
            if (!prepared.retryable) {
              preparedForm.current = null;
              setDraft(false);
            }
            return {
              error: prepared.error || "No se pudo preparar el registro.",
            };
          }
          currentPlan.current = prepared.plan;
          setDraft(true);
        }
        if (photos.length)
          await uploadPreparedPhotos(
            browserDatabase(),
            currentPlan.current,
            photos,
            setProgress,
          );
        setProgress("Validando y confirmando la observación…");
        return complete(
          await finishObservation(currentPlan.current.observation),
        );
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "No se pudo confirmar el registro. Conserva esta pantalla y vuelve a guardar.",
        };
      } finally {
        setProgress("");
      }
    },
    {} as ObservationResult,
  );
  return (
    <form
      action={action}
      className="form-stack"
      data-dirty={!!body || photos.length > 0}
    >
      <input type="hidden" name="project" value={project} />
      <label>
        Observación de la visita
        <textarea
          name="body"
          disabled={pending || draft}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          maxLength={10000}
          placeholder="Qué revisaste, qué cambió y qué debe quedar registrado…"
        />
      </label>
      <label>
        Fecha de visita
        <input
          type="date"
          name="observed_on"
          disabled={pending || draft}
          value={observedOn}
          onChange={(e) => setObservedOn(e.target.value)}
          max={today}
          required
        />
      </label>
      <label>
        Fotografías (hasta cinco)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          disabled={pending || preparing || draft}
          onChange={async (e) => {
            const selected = Array.from(e.target.files || []);
            e.target.value = "";
            if (photos.length + selected.length > 5) {
              setPhotoError(
                "Puedes adjuntar hasta cinco fotografías por observación.",
              );
              return;
            }
            setPreparing(true);
            setPhotoError("");
            try {
              const next: File[] = [];
              for (const file of selected) next.push(await prepare(file));
              setPhotos([...photos, ...next]);
            } catch (err) {
              setPhotoError(
                err instanceof Error
                  ? err.message
                  : "No se pudo preparar la fotografía.",
              );
            } finally {
              setPreparing(false);
            }
          }}
        />
      </label>
      <p className="caption">
        Se preparan copias ligeras para consulta y se retiran datos de
        ubicación. Tus originales permanecen en el dispositivo. Las fotos son
        privadas para los miembros del estudio.
      </p>
      {preparing && <p role="status">Preparando fotografías…</p>}
      {photos.map((photo, i) => (
        <div key={i} className="form-actions">
          <span>{photo.name}</span>
          <Button
            type="button"
            variant="ghost"
            disabled={pending || draft}
            onClick={() => setPhotos(photos.filter((_, index) => index !== i))}
          >
            Quitar foto {i + 1}
          </Button>
        </div>
      ))}
      {draft && (
        <p className="caption">
          Intento preparado. Guardar reanuda esta misma observación; descártalo
          antes de cambiar texto o fotografías. No cierres esta pantalla durante
          la carga.
        </p>
      )}
      {progress && <p role="status">{progress}</p>}
      <Status {...state} error={photoError || state.error} />
      {draft && (
        <Button
          type="submit"
          name="intent"
          value="discard"
          formNoValidate
          variant="ghost"
          disabled={pending}
        >
          Descartar intento
        </Button>
      )}
      <Button disabled={pending || preparing}>
        {pending ? "Guardando registro…" : "Guardar observación"}
      </Button>
    </form>
  );
}

import { Camera, Images, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { fileToCompressedDataUrl } from "../lib/imageEvidence";
import { armFilePickerGuard, settleFilePickerGuard } from "../lib/overlayGuard";

type Props = {
  id: string;
  label: string;
  hint?: string;
  readyHint?: string;
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
};

type PhotoSource = "gallery" | "camera";

/** Zona de foto en español. Galería y cámara son acciones distintas (Android no mezcla `capture`). */
export function PhotoDrop({
  id,
  label,
  hint = "Opcional · JPG o PNG",
  readyHint,
  value,
  onChange,
  disabled,
}: Props) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const settle = () => settleFilePickerGuard();
    const onVisibility = () => {
      if (document.visibilityState === "visible") settle();
    };
    window.addEventListener("focus", settle);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", settle);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    settleFilePickerGuard(true);
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await fileToCompressedDataUrl(file));
    } catch (err) {
      onChange(null);
      setError(err instanceof Error ? err.message : "No se pudo leer la foto");
    } finally {
      setBusy(false);
    }
  }

  function openPicker(source: PhotoSource) {
    if (disabled || busy) return;
    armFilePickerGuard();
    const node = source === "camera" ? cameraRef.current : galleryRef.current;
    node?.click();
  }

  function clear() {
    onChange(null);
    setError(null);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  return (
    <div className="field">
      <span className="field-label" id={`${id}-label`}>
        {label}
      </span>
      {value ? (
        <div className="pay-photo-ready">
          <img src={value} alt="" />
          <div className="pay-photo-ready-meta">
            <strong>Foto lista</strong>
            {readyHint ? <span className="muted small">{readyHint}</span> : null}
            <button
              type="button"
              className="pay-photo-remove"
              disabled={disabled}
              onClick={clear}
            >
              <Trash2 size={14} aria-hidden />
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <div className={disabled || busy ? "pay-photo-drop is-disabled" : "pay-photo-drop"}>
          <input
            ref={galleryRef}
            id={`${id}-gallery`}
            className="visually-hidden"
            type="file"
            accept="image/*"
            disabled={disabled || busy}
            aria-labelledby={`${id}-label`}
            onChange={(e) => void onFile(e)}
          />
          <input
            ref={cameraRef}
            id={`${id}-camera`}
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={disabled || busy}
            aria-labelledby={`${id}-label`}
            onChange={(e) => void onFile(e)}
          />
          <ImagePlus size={22} aria-hidden />
          <strong>{busy ? "Procesando foto…" : "Subir foto"}</strong>
          <span>{hint}</span>
          <div className="pay-photo-sources" role="group" aria-label="Origen de la foto">
            <button
              type="button"
              className="pay-photo-source"
              disabled={disabled || busy}
              onClick={() => openPicker("gallery")}
            >
              <Images size={16} aria-hidden />
              Galería
            </button>
            <button
              type="button"
              className="pay-photo-source"
              disabled={disabled || busy}
              onClick={() => openPicker("camera")}
            >
              <Camera size={16} aria-hidden />
              Cámara
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

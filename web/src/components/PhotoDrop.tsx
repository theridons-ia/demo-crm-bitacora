import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { fileToCompressedDataUrl } from "../lib/imageEvidence";

type Props = {
  id: string;
  label: string;
  hint?: string;
  readyHint?: string;
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
};

/** Zona de foto en español. Nunca mostrar `<input type="file">` nativo. */
export function PhotoDrop({
  id,
  label,
  hint = "Opcional · JPG o PNG",
  readyHint,
  value,
  onChange,
  disabled,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
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

  function clear() {
    onChange(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
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
        <label
          className={disabled || busy ? "pay-photo-drop is-disabled" : "pay-photo-drop"}
          htmlFor={id}
        >
          <input
            ref={fileRef}
            id={id}
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
        </label>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

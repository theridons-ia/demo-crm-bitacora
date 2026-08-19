import { Camera, Images, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { fileToCompressedDataUrl } from "../lib/imageEvidence";
import {
  armFilePickerGuard,
  holdFilePickerGuard,
  settleFilePickerGuard,
} from "../lib/overlayGuard";
import { useEscapeKey } from "../hooks/useOverlay";
import { Button } from "./Button";

type BaseProps = {
  id: string;
  label: string;
  hint?: string;
  readyHint?: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
};

type SingleProps = BaseProps & {
  value: string | null;
  onChange: (next: string | null) => void;
  multiple?: false;
  maxFiles?: 1;
};

type MultiProps = BaseProps & {
  value: string[];
  onChange: (next: string[]) => void;
  multiple: true;
  maxFiles?: number;
};

type Props = SingleProps | MultiProps;

type SourceSheet = "chooser" | "camera" | null;

/**
 * Foto de comprobante: un tap abre Galería o Cámara (trasera).
 * Cancelar el picker nativo no cierra el wizard.
 */
export function PhotoDrop({
  id,
  label,
  hint = "Opcional · JPG o PNG",
  readyHint,
  value,
  onChange,
  disabled,
  multiple = false,
  maxFiles = 1,
  onBusyChange,
}: Props) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SourceSheet>(null);

  useEscapeKey(sheet != null, () => {
    stopCamera();
    setSheet(null);
  });

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (sheet !== "camera") return;
    let cancelled = false;
    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setSheet(null);
        openNativeCamera();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      } catch {
        if (!cancelled) {
          stopCamera();
          setSheet(null);
          openNativeCamera();
        }
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
    // openNativeCamera is stable enough for this overlay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  const files = Array.isArray(value) ? value : value ? [value] : [];
  const hasValue = files.length > 0;

  async function applyFiles(nextFiles: File[]) {
    holdFilePickerGuard();
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const processed = await Promise.all(nextFiles.map((file) => fileToCompressedDataUrl(file)));
      if (multiple) {
        (onChange as (next: string[]) => void)([...files, ...processed].slice(0, maxFiles));
      } else {
        (onChange as (next: string | null) => void)(processed[0] ?? null);
      }
    } catch (err) {
      if (!multiple) {
        (onChange as (next: string | null) => void)(null);
      }
      setError(err instanceof Error ? err.message : "No se pudo leer la foto");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      settleFilePickerGuard(true);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    setSheet(null);
    if (!picked.length) {
      settleFilePickerGuard(true);
      return;
    }
    const allowed = multiple ? Math.max(0, maxFiles - files.length) : 1;
    const next = picked.slice(0, allowed);
    if (!next.length) {
      settleFilePickerGuard(true);
      return;
    }
    await applyFiles(multiple ? [...next].slice(0, allowed) : [next[0]]);
  }

  function openGallery() {
    setSheet(null);
    armFilePickerGuard();
    window.setTimeout(() => galleryRef.current?.click(), 40);
  }

  function openNativeCamera() {
    armFilePickerGuard();
    window.setTimeout(() => cameraRef.current?.click(), 40);
  }

  async function openLiveCamera() {
    setError(null);
    setSheet("camera");
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    stopCamera();
    setSheet(null);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
    if (!blob) {
      setError("No se pudo capturar la foto");
      return;
    }
    await applyFiles([new File([blob], "comprobante.jpg", { type: "image/jpeg" })]);
  }

  function clear(index?: number) {
    if (multiple) {
      if (typeof index !== "number") {
        (onChange as (next: string[]) => void)([]);
      } else {
        (onChange as (next: string[]) => void)(files.filter((_, i) => i !== index));
      }
    } else {
      (onChange as (next: string | null) => void)(null);
    }
    setError(null);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  return (
    <div className="field">
      <span className="field-label" id={`${id}-label`}>
        {label}
      </span>
      <input
        ref={galleryRef}
        id={`${id}-gallery`}
        className="file-input-offscreen"
        type="file"
        accept="image/*"
        multiple={multiple}
        disabled={disabled || busy}
        aria-labelledby={`${id}-label`}
        onChange={(e) => void onFile(e)}
      />
      <input
        ref={cameraRef}
        id={`${id}-camera`}
        className="file-input-offscreen"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled || busy}
        aria-labelledby={`${id}-label`}
        onChange={(e) => void onFile(e)}
      />
      {hasValue ? (
        <div className={multiple ? "pay-photo-ready is-multi" : "pay-photo-ready"}>
          <div className={multiple ? "pay-photo-grid" : undefined}>
            {files.map((src, index) => (
              <div key={`${id}-${index}`} className="pay-photo-frame">
                <img src={src} alt="" />
                {multiple ? (
                  <button
                    type="button"
                    className="pay-photo-remove pay-photo-remove-thumb"
                    disabled={disabled}
                    aria-label={`Quitar foto ${index + 1}`}
                    onClick={() => clear(index)}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="pay-photo-ready-meta">
            <strong>{multiple ? `${files.length} foto${files.length === 1 ? "" : "s"} lista${files.length === 1 ? "" : "s"}` : "Foto lista"}</strong>
            {readyHint ? <span className="muted small">{readyHint}</span> : null}
            <div className="pay-photo-ready-actions">
              {multiple && files.length < maxFiles ? (
                <button
                  type="button"
                  className="pay-photo-remove"
                  disabled={disabled || busy}
                  onClick={() => {
                    if (disabled || busy) return;
                    setSheet("chooser");
                  }}
                >
                  <ImagePlus size={14} aria-hidden />
                  Agregar otra
                </button>
              ) : null}
              <button
                type="button"
                className="pay-photo-remove"
                disabled={disabled}
                onClick={() => clear()}
              >
                <Trash2 size={14} aria-hidden />
                Quitar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={disabled || busy ? "pay-photo-drop is-disabled" : "pay-photo-drop"}
          disabled={disabled || busy}
          onClick={() => {
            if (disabled || busy) return;
            setSheet("chooser");
          }}
        >
          <ImagePlus size={22} aria-hidden />
          <strong>{busy ? "Subiendo imagen…" : multiple ? "Subir fotos" : "Subir foto"}</strong>
          <span>{hint}</span>
          {busy ? <span className="photo-upload-bar" aria-hidden /> : null}
        </button>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {sheet != null && typeof document !== "undefined"
        ? createPortal(
            <div className={sheet === "camera" ? "photo-source-overlay is-camera" : "photo-source-overlay"} role="presentation">
              <button
                type="button"
                className="app-overlay-backdrop"
                aria-label="Cerrar"
                onClick={() => {
                  stopCamera();
                  setSheet(null);
                }}
              />
              {sheet === "chooser" ? (
                <div
                  className="photo-source-sheet"
                  role="dialog"
                  aria-labelledby={`${id}-source-title`}
                >
                  <p className="eyebrow">Comprobante</p>
                  <h3 id={`${id}-source-title`}>¿De dónde sale la foto?</h3>
                  <button type="button" className="photo-source-row" onClick={openGallery}>
                    <Images size={18} aria-hidden />
                    Galería
                  </button>
                  <button
                    type="button"
                    className="photo-source-row"
                    onClick={() => void openLiveCamera()}
                  >
                    <Camera size={18} aria-hidden />
                    Cámara (trasera)
                  </button>
                  <Button type="button" variant="ghost" onClick={() => setSheet(null)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="photo-camera-sheet" role="dialog" aria-label="Cámara">
                  <video
                    ref={videoRef}
                    className="photo-camera-video"
                    playsInline
                    muted
                    autoPlay
                  />
                  <div className="photo-camera-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        stopCamera();
                        setSheet(null);
                      }}
                    >
                      <X size={16} aria-hidden />
                      Cancelar
                    </Button>
                    <Button type="button" variant="accent" onClick={() => void captureFrame()}>
                      Tomar foto
                    </Button>
                  </div>
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

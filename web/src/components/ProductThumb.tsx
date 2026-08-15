import { Package } from "lucide-react";
import { useEffect, useState } from "react";

type Size = "sm" | "md";

type Props = {
  src?: string | null;
  alt?: string;
  size?: Size;
};

/** Miniatura de producto. Si no hay foto, icono de paquete. */
export function ProductThumb({ src, alt = "", size = "sm" }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (src && !failed) {
    return (
      <span className={`product-thumb is-${size}`} aria-hidden={!alt}>
        <img src={src} alt={alt} onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span className={`product-thumb is-${size} is-fallback`} aria-hidden>
      <Package size={size === "md" ? 18 : 15} />
    </span>
  );
}

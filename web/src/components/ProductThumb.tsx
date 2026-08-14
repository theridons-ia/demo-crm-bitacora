import { Package } from "lucide-react";

type Size = "sm" | "md";

type Props = {
  src?: string | null;
  alt?: string;
  size?: Size;
};

/** Miniatura de producto. Si no hay foto, icono de paquete. */
export function ProductThumb({ src, alt = "", size = "sm" }: Props) {
  if (src) {
    return (
      <span className={`product-thumb is-${size}`} aria-hidden={!alt}>
        <img src={src} alt={alt} />
      </span>
    );
  }
  return (
    <span className={`product-thumb is-${size} is-fallback`} aria-hidden>
      <Package size={size === "md" ? 18 : 15} />
    </span>
  );
}

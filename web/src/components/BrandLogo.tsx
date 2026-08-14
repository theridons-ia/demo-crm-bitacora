type Props = {
  /** Tamaño del logo (px). */
  size?: number;
  className?: string;
  /** Solo icono o icono + wordmark. */
  withWordmark?: boolean;
};

/** Marca EnRutas — logo pin + check + ruta. */
export function BrandLogo({ size = 40, className = "", withWordmark = false }: Props) {
  return (
    <span className={`brand-logo ${withWordmark ? "brand-logo-row" : ""} ${className}`.trim()}>
      <img
        src="/brand/enrutas-logo.png"
        alt=""
        width={size}
        height={Math.round(size * (512 / 430))}
        className="brand-logo-img"
        decoding="async"
      />
      {withWordmark ? (
        <span className="brand-wordmark">
          <span className="brand-name">EnRutas</span>
          <span className="brand-tag muted small">Campo · operaciones</span>
        </span>
      ) : (
        <span className="visually-hidden">EnRutas</span>
      )}
    </span>
  );
}

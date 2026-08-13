type Props = {
  label?: string;
  className?: string;
  size?: "sm" | "md";
  /** Solo el punto (filas compactas). */
  showLabel?: boolean;
};

/** LED parpadeante para visitas en curso — usar en fichas, listas y badges. */
export function LiveLed({
  label = "En curso",
  className = "",
  size = "sm",
  showLabel = true,
}: Props) {
  return (
    <span className={`live-led size-${size} ${className}`.trim()} title={label} aria-label={label}>
      <span className="live-led-dot" aria-hidden />
      {showLabel ? <span className="live-led-label">{label}</span> : null}
    </span>
  );
}

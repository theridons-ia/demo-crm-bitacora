type Props = {
  label?: string;
  className?: string;
  size?: "sm" | "md";
};

/** LED parpadeante para visitas en curso — usar en fichas, listas y badges. */
export function LiveLed({ label = "En curso", className = "", size = "sm" }: Props) {
  return (
    <span className={`live-led size-${size} ${className}`.trim()} title={label}>
      <span className="live-led-dot" aria-hidden />
      <span className="live-led-label">{label}</span>
    </span>
  );
}

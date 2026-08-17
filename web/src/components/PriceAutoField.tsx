type Props = {
  id: string;
  label: string;
  value: string;
  auto: boolean;
  onAutoChange: (next: boolean) => void;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  step?: string;
  autoLabel?: string;
  prefix?: string;
  /** Si false, el valor se puede editar también en modo Auto/Margen (ej. el %). */
  readOnlyWhenAuto?: boolean;
};

/** Precio con switch Auto/Manual (o Margen). Auto deja el input bloqueado, salvo el %. */
export function PriceAutoField({
  id,
  label,
  value,
  auto,
  onAutoChange,
  onChange,
  hint,
  placeholder,
  step = "0.01",
  autoLabel = "Auto",
  prefix,
  readOnlyWhenAuto = true,
}: Props) {
  const locked = auto && readOnlyWhenAuto;
  return (
    <div className="field price-auto-field">
      <div className="price-auto-head">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <div className="choice-group" role="group" aria-label={`${label} modo`}>
          <button
            type="button"
            className={auto ? "chip active" : "chip"}
            aria-pressed={auto}
            onClick={() => onAutoChange(true)}
          >
            {autoLabel}
          </button>
          <button
            type="button"
            className={!auto ? "chip active" : "chip"}
            aria-pressed={!auto}
            onClick={() => onAutoChange(false)}
          >
            Manual
          </button>
        </div>
      </div>
      <div className={prefix ? "price-input-wrap" : undefined}>
        {prefix ? <span className="price-affix">{prefix}</span> : null}
        <input
          id={id}
          className="input"
          type="number"
          step={step}
          min="0"
          value={value}
          placeholder={placeholder}
          disabled={locked}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

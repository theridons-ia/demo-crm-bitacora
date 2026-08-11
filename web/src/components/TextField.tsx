import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
};

/** Campo de texto del design system. */
export function TextField({ label, id, className = "", ...rest }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={`input ${className}`.trim()} {...rest} />
    </div>
  );
}

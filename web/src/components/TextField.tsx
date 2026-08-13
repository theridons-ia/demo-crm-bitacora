import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
};

/** Envoltorio de campo estándar (label + control + hint). */
export function FieldShell({ id, label, hint, children }: FieldShellProps) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  hint?: string;
};

/** Campo de texto del design system. */
export function TextField({ label, id, className = "", hint, ...rest }: Props) {
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <input id={id} className={`input ${className}`.trim()} {...rest} />
    </FieldShell>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  id: string;
  hint?: string;
  children: ReactNode;
};

export function SelectField({ label, id, hint, className = "", children, ...rest }: SelectProps) {
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <select id={id} className={`input ${className}`.trim()} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  id: string;
  hint?: string;
};

export function TextAreaField({ label, id, hint, className = "", ...rest }: AreaProps) {
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <textarea id={id} className={`input input-area ${className}`.trim()} rows={3} {...rest} />
    </FieldShell>
  );
}

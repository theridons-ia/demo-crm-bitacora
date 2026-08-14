import { useEffect, useRef } from "react";

type Props = {
  steps: { id: string; label: string }[];
  current: number;
  className?: string;
};

/** Rail visual 1 ——— 2 ——— 3 para wizards (venta, alta visita…). */
export function WizardSteps({ steps, current, className = "" }: Props) {
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const body = ref.current?.closest(".app-modal-body");
    if (body instanceof HTMLElement) body.scrollTop = 0;
  }, [current]);

  return (
    <ol ref={ref} className={`wizard-steps ${className}`.trim()} aria-label="Pasos">
      {steps.map((step, index) => {
        const n = index + 1;
        const state = index < current ? "done" : index === current ? "active" : "todo";
        return (
          <li key={step.id} className={`wizard-step is-${state}`}>
            {index > 0 ? <span className="wizard-step-rail" aria-hidden /> : null}
            <span className="wizard-step-node" aria-current={state === "active" ? "step" : undefined}>
              <span className="wizard-step-num">{n}</span>
              <span className="wizard-step-label">{step.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

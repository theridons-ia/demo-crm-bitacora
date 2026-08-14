import { Button } from "./Button";

type Props = {
  step: number;
  submitting?: boolean;
  nextDisabled?: boolean;
  onBack: () => void;
  primaryLabel: string;
  onPrimary?: () => void;
  primaryType?: "button" | "submit";
  form?: string;
};

/** Footer de wizard: Anterior a la izquierda; Siguiente / Confirmar siempre visible. */
export function WizardFooter({
  step,
  submitting,
  nextDisabled,
  onBack,
  primaryLabel,
  onPrimary,
  primaryType = "button",
  form,
}: Props) {
  const hasBack = step > 0;
  return (
    <div className={hasBack ? "wizard-footer has-back" : "wizard-footer"}>
      {hasBack ? (
        <Button type="button" variant="ghost" disabled={submitting} onClick={onBack}>
          Anterior
        </Button>
      ) : null}
      <Button
        type={primaryType}
        form={form}
        variant="accent"
        disabled={submitting || nextDisabled}
        onClick={onPrimary}
      >
        {primaryLabel}
      </Button>
    </div>
  );
}

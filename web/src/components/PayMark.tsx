import { Landmark } from "lucide-react";
import { useEffect, useState } from "react";
import { payMarkCandidates } from "../lib/payMarks";

type Size = "sm" | "md";

type Props = {
  slugs: string[];
  label: string;
  size?: Size;
};

function initials(label: string): string {
  const parts = label
    .replace(/banco/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = (parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase();
}

/** Logo de cobro (Zelle, USDT, banco). Si no hay archivo, iniciales. */
export function PayMark({ slugs, label, size = "sm" }: Props) {
  const candidates = payMarkCandidates(slugs);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [slugs.join("|")]);
  const src = candidates[index];

  if (!src) {
    return (
      <span className={`pay-mark is-${size} is-fallback`} aria-hidden>
        {slugs.length ? initials(label) : <Landmark size={size === "md" ? 18 : 15} />}
      </span>
    );
  }

  return (
    <span className={`pay-mark is-${size}`} aria-hidden={!label}>
      <img
        src={src}
        alt=""
        onError={() => setIndex((cur) => cur + 1)}
      />
    </span>
  );
}

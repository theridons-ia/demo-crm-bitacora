import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { PayMark } from "./PayMark";
import { ProductThumb } from "./ProductThumb";

export type SearchPickOption = {
  id: number;
  title: string;
  subtitle?: string;
  /** Si viene (aunque sea null), se muestra miniatura de producto. */
  imageUrl?: string | null;
  /** Logo de banco / medio de cobro (`/pay/{slug}`). */
  markSlug?: string;
};

type Props = {
  id?: string;
  placeholder: string;
  valueId: number | null;
  options: SearchPickOption[];
  disabled?: boolean;
  onChange: (id: number | null) => void;
  emptyLabel?: string;
  labelledBy?: string;
  "aria-label"?: string;
};

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesQuery(option: SearchPickOption, query: string): boolean {
  if (!query) return true;
  const hay = fold(`${option.title} ${option.subtitle ?? ""}`);
  return query.split(/\s+/).every((part) => hay.includes(part));
}

/** Selector con búsqueda: el nombre se lee entero; no usa `<select>` nativo. */
export function SearchPickField({
  id,
  placeholder,
  valueId,
  options,
  disabled,
  onChange,
  emptyLabel = "Sin coincidencias",
  labelledBy,
  "aria-label": ariaLabel,
}: Props) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listId = `${fieldId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchArmedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchArmed, setSearchArmed] = useState(false);

  const selected = useMemo(
    () => options.find((option) => option.id === valueId) ?? null,
    [options, valueId],
  );

  const filtered = useMemo(() => {
    const q = fold(query);
    return options.filter((option) => matchesQuery(option, q));
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      searchArmedRef.current = false;
      setSearchArmed(false);
      setQuery("");
      return;
    }
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  /** El teclado solo sale si el vendedor toca Buscar, no al abrir la lista. */
  function armSearch(el: HTMLInputElement) {
    if (searchArmedRef.current) return;
    el.readOnly = false;
    searchArmedRef.current = true;
    setSearchArmed(true);
  }

  function choose(option: SearchPickOption) {
    onChange(option.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`search-pick${open ? " is-open" : ""}`}>
      <button
        type="button"
        id={fieldId}
        className="search-pick-trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelledBy}
        aria-label={ariaLabel ?? (labelledBy ? undefined : placeholder)}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => {
            const next = !prev;
            if (next) setQuery("");
            return next;
          });
        }}
      >
        <span className="search-pick-trigger-main">
          {selected?.markSlug ? (
            <PayMark slugs={[selected.markSlug]} label={selected.title} />
          ) : selected && "imageUrl" in selected ? (
            <ProductThumb src={selected.imageUrl} alt="" />
          ) : null}
          <span className="search-pick-copy">
            {selected ? (
              <>
                <strong className="search-pick-title">{selected.title}</strong>
                {selected.subtitle ? (
                  <span className="search-pick-sub">{selected.subtitle}</span>
                ) : null}
              </>
            ) : (
              <span className="search-pick-placeholder">{placeholder}</span>
            )}
          </span>
        </span>
        <ChevronDown className="search-pick-chevron" size={16} aria-hidden />
      </button>

      {open ? (
        <div className="search-pick-panel" id={listId} role="listbox">
          <div className="search-pick-search">
            <Search size={15} aria-hidden />
            <input
              className="input"
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              readOnly={!searchArmed}
              placeholder="Buscar…"
              value={query}
              aria-label="Buscar"
              onTouchStart={(e) => armSearch(e.currentTarget)}
              onMouseDown={(e) => armSearch(e.currentTarget)}
              onFocus={(e) => {
                if (e.currentTarget.readOnly) e.currentTarget.blur();
              }}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            />
          </div>
          {filtered.length ? (
            <ul className="search-pick-list">
              {filtered.map((option) => {
                const active = option.id === valueId;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={active ? "search-pick-option is-active" : "search-pick-option"}
                      onClick={() => choose(option)}
                    >
                      {option.markSlug ? (
                        <PayMark slugs={[option.markSlug]} label={option.title} />
                      ) : "imageUrl" in option ? (
                        <ProductThumb src={option.imageUrl} alt="" />
                      ) : null}
                      <span className="search-pick-option-copy">
                        <strong className="search-pick-title">{option.title}</strong>
                        {option.subtitle ? (
                          <span className="search-pick-sub">{option.subtitle}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted small search-pick-empty">{emptyLabel}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

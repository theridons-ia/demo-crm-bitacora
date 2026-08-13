import { Search } from "lucide-react";
import { TextField } from "./TextField";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
};

/** Buscador estándar de listas (mismo patrón en clientes / inventario / catálogo). */
export function ListSearch({
  id,
  value,
  onChange,
  placeholder = "Buscar…",
  label = "Buscar",
}: Props) {
  return (
    <div className="search-wrap">
      <Search size={16} aria-hidden />
      <TextField
        id={id}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

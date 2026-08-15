/** Bancos US más usados en Venezuela para cobrar en dólares (Zelle / wire). */

export type UsBank = {
  id: number;
  name: string;
  shortName: string;
  slug: string;
};

export const US_BANKS: UsBank[] = [
  { id: 9101, name: "Bank of America", shortName: "BofA", slug: "bofa" },
  { id: 9102, name: "Chase", shortName: "Chase", slug: "chase" },
  { id: 9103, name: "Wells Fargo", shortName: "Wells Fargo", slug: "wellsfargo" },
  { id: 9104, name: "Citibank", shortName: "Citi", slug: "citi" },
  { id: 9105, name: "Capital One", shortName: "Capital One", slug: "capitalone" },
];

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function findUsBank(query: string | null | undefined): UsBank | undefined {
  if (!query) return undefined;
  const q = fold(query);
  const exact = US_BANKS.find(
    (bank) => fold(bank.name) === q || fold(bank.shortName) === q || bank.slug === q,
  );
  if (exact) return exact;
  const partial = US_BANKS.filter(
    (bank) => fold(bank.name).startsWith(q) || fold(bank.shortName).startsWith(q),
  );
  return partial.length === 1 ? partial[0] : undefined;
}

export function usBankByPickId(id: number | null): UsBank | undefined {
  if (id == null) return undefined;
  return US_BANKS.find((bank) => bank.id === id);
}

/** Bancos nacionales VE (códigos SUDEBAN) para transferencia y pago móvil en Bs. */

export type VeBank = {
  code: string;
  name: string;
  shortName: string;
  slug: string;
};

export const VE_BANKS: VeBank[] = [
  { code: "0102", name: "Banco de Venezuela", shortName: "BDV", slug: "bdv" },
  { code: "0104", name: "Venezolano de Crédito", shortName: "BVC", slug: "bvc" },
  { code: "0105", name: "Mercantil Banco", shortName: "Mercantil", slug: "mercantil" },
  { code: "0108", name: "BBVA Provincial", shortName: "Provincial", slug: "provincial" },
  { code: "0114", name: "Bancaribe", shortName: "Bancaribe", slug: "bancaribe" },
  { code: "0115", name: "Banco Exterior", shortName: "Exterior", slug: "exterior" },
  { code: "0128", name: "Banco Caroní", shortName: "Caroní", slug: "caroni" },
  { code: "0134", name: "Banesco", shortName: "Banesco", slug: "banesco" },
  { code: "0137", name: "Banco Sofitasa", shortName: "Sofitasa", slug: "sofitasa" },
  { code: "0138", name: "Banco Plaza", shortName: "Plaza", slug: "plaza" },
  { code: "0146", name: "Bangente", shortName: "Bangente", slug: "bangente" },
  { code: "0151", name: "BFC Banco Fondo Común", shortName: "BFC", slug: "bfc" },
  { code: "0156", name: "100% Banco", shortName: "100% Banco", slug: "100banco" },
  { code: "0157", name: "DelSur Banco Universal", shortName: "DelSur", slug: "delsur" },
  { code: "0163", name: "Banco del Tesoro", shortName: "Tesoro", slug: "tesoro" },
  { code: "0166", name: "Banco Agrícola de Venezuela", shortName: "Agrícola", slug: "agricola" },
  { code: "0168", name: "Bancrecer", shortName: "Bancrecer", slug: "bancrecer" },
  { code: "0169", name: "Mi Banco", shortName: "Mi Banco", slug: "mibanco" },
  { code: "0171", name: "Banco Activo", shortName: "Activo", slug: "activo" },
  { code: "0172", name: "Bancamiga", shortName: "Bancamiga", slug: "bancamiga" },
  { code: "0173", name: "Banco Internacional de Desarrollo", shortName: "BID", slug: "bid" },
  { code: "0174", name: "Banplus", shortName: "Banplus", slug: "banplus" },
  { code: "0175", name: "Banco Bicentenario", shortName: "Bicentenario", slug: "bicentenario" },
  { code: "0007", name: "Banco Digital de los Trabajadores", shortName: "BDT", slug: "bdt" },
  { code: "0177", name: "BANFANB", shortName: "BANFANB", slug: "banfanb" },
  { code: "0178", name: "N58 Banco Digital", shortName: "N58", slug: "n58" },
  { code: "0191", name: "Banco Nacional de Crédito", shortName: "BNC", slug: "bnc" },
  { code: "0601", name: "Instituto Municipal de Crédito Popular", shortName: "IMCP", slug: "imcp" },
];

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function findVeBank(query: string | null | undefined): VeBank | undefined {
  if (!query) return undefined;
  const digits = query.replace(/\D/g, "");
  if (digits.length === 4) {
    const byCode = VE_BANKS.find((bank) => bank.code === digits);
    if (byCode) return byCode;
  }
  const q = fold(query);
  const exact = VE_BANKS.find(
    (bank) => fold(bank.name) === q || fold(bank.shortName) === q || bank.slug === q,
  );
  if (exact) return exact;
  const partial = VE_BANKS.filter(
    (bank) => fold(bank.name).startsWith(q) || fold(bank.shortName).startsWith(q),
  );
  return partial.length === 1 ? partial[0] : undefined;
}

export function veBankPickId(bank: VeBank): number {
  return Number(bank.code);
}

export function veBankByPickId(id: number | null): VeBank | undefined {
  if (id == null) return undefined;
  return VE_BANKS.find((bank) => veBankPickId(bank) === id);
}

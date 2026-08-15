import type { BankAccount } from "./types";

export function payAccountShareText(account: BankAccount): string {
  const lines = [
    `EnRutas — ${account.name}`,
    account.bank_name ? `Banco: ${account.bank_name}` : null,
    account.currency === "VES" ? "Moneda: Bs" : `Moneda: ${account.currency}`,
    account.pay_hint,
  ].filter(Boolean);
  return lines.join("\n");
}

export function payAccountsBundleText(accounts: BankAccount[]): string {
  return ["EnRutas — cuentas de cobro", "", ...accounts.map((a) => payAccountShareText(a))]
    .join("\n")
    .trim();
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

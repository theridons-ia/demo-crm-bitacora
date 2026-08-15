import type { BankAccount } from "./types";
import { findUsBank } from "./usBanks";
import { findVeBank } from "./veBanks";

function holderLine(account: BankAccount): string | null {
  const holder = account.holder_name?.trim() || account.name.trim();
  return holder ? `Nombre: ${holder}` : null;
}

export function payAccountShareText(account: BankAccount): string {
  const hint = account.pay_hint?.trim() || null;
  if (account.account_type === "zelle") {
    return ["EnRutas — Zelle", holderLine(account), hint ? `Correo: ${hint}` : null]
      .filter(Boolean)
      .join("\n");
  }
  if (account.account_type === "usdt") {
    return ["EnRutas — USDT", holderLine(account), hint]
      .filter(Boolean)
      .join("\n");
  }
  const ve = findVeBank(account.bank_name);
  const us = findUsBank(account.bank_name);
  const bankLabel = ve
    ? `${ve.name} (${ve.code})`
    : us
      ? us.name
      : account.bank_name;
  return [
    `EnRutas — ${account.name}`,
    bankLabel ? `Banco: ${bankLabel}` : null,
    holderLine(account),
    account.currency === "VES" ? "Moneda: Bs" : `Moneda: ${account.currency}`,
    hint,
  ]
    .filter(Boolean)
    .join("\n");
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

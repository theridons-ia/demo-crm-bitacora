import type { BankAccount } from "./types";
import { findUsBank } from "./usBanks";
import { findVeBank } from "./veBanks";

/** Slugs a probar en `/pay/{slug}.png|svg`. El primero que exista gana. */
export function payMarkSlugs(account: Pick<BankAccount, "account_type" | "bank_name">): string[] {
  if (account.account_type === "zelle") return ["zelle"];
  if (account.account_type === "usdt") return ["usdt", "binance"];
  if (account.account_type === "cash") return ["cash"];
  const ve = findVeBank(account.bank_name);
  if (ve) return [ve.slug];
  const us = findUsBank(account.bank_name);
  if (us) return [us.slug];
  return [];
}

export function payMarkCandidates(slugs: string[]): string[] {
  const out: string[] = [];
  for (const slug of slugs) {
    if (!slug) continue;
    out.push(`/pay/${slug}.png`, `/pay/${slug}.svg`, `/pay/${slug}.webp`);
  }
  return out;
}

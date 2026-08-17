"""Precios derivados: P2 = P1 × (USDT/BCV), P1 margen = P2 ÷ diferencial, P3 = P2 × USD BCV."""

from decimal import Decimal, ROUND_HALF_UP

from ..models import CurrencyCode, Product
from ..schemas import ProductOut

CENTS = Decimal("0.01")


def usdt_bcv_spread(bcv: Decimal | None, usdt: Decimal | None) -> Decimal | None:
    if bcv is None or usdt is None or bcv <= 0 or usdt <= 0:
        return None
    return usdt / bcv


def derive_price_usd_2(price_usd: Decimal, bcv: Decimal | None, usdt: Decimal | None) -> Decimal | None:
    spread = usdt_bcv_spread(bcv, usdt)
    if spread is None:
        return None
    return (price_usd * spread).quantize(CENTS, rounding=ROUND_HALF_UP)


def derive_price_usd_1(
    price_usd_2: Decimal | None, bcv: Decimal | None, usdt: Decimal | None
) -> Decimal | None:
    spread = usdt_bcv_spread(bcv, usdt)
    if spread is None or price_usd_2 is None or spread <= 0:
        return None
    return (price_usd_2 / spread).quantize(CENTS, rounding=ROUND_HALF_UP)


def derive_price_ves(price_usd_2: Decimal | None, bcv: Decimal | None) -> Decimal | None:
    if price_usd_2 is None or bcv is None or bcv <= 0:
        return None
    return (price_usd_2 * bcv).quantize(CENTS, rounding=ROUND_HALF_UP)


def apply_auto_prices(
    data: dict,
    *,
    bcv: Decimal | None,
    usdt: Decimal | None,
) -> dict:
    """Rellena P1/P2/P3 si los switches están en auto. P2 auto gana si ambos están activos."""
    p1_auto = bool(data.get("price_usd_auto", False))
    p2_auto = bool(data.get("price_usd_2_auto", True))
    p3_auto = bool(data.get("price_ves_auto", True))
    if p1_auto and p2_auto:
        p1_auto = False
    p1 = data.get("price_usd")
    p2 = data.get("price_usd_2")
    if p2_auto:
        derived = derive_price_usd_2(Decimal(str(p1 or 0)), bcv, usdt)
        if derived is not None:
            p2 = derived
            data["price_usd_2"] = derived
    elif p1_auto:
        derived = derive_price_usd_1(Decimal(str(p2)) if p2 is not None else None, bcv, usdt)
        if derived is not None:
            p1 = derived
            data["price_usd"] = derived
    if p3_auto:
        derived = derive_price_ves(Decimal(str(p2)) if p2 is not None else None, bcv)
        if derived is not None:
            data["price_ves"] = derived
    return data


def product_to_out(
    product: Product,
    *,
    bcv: Decimal | None,
    usdt: Decimal | None,
) -> ProductOut:
    row = ProductOut.model_validate(product)
    p1 = row.price_usd
    p2 = row.price_usd_2
    p3 = row.price_ves
    p1_auto = bool(row.price_usd_auto)
    p2_auto = bool(row.price_usd_2_auto)
    if p1_auto and p2_auto:
        p1_auto = False
    if p2_auto:
        derived = derive_price_usd_2(Decimal(p1), bcv, usdt)
        if derived is not None:
            p2 = derived
    elif p1_auto:
        derived = derive_price_usd_1(p2, bcv, usdt)
        if derived is not None:
            p1 = derived
    if row.price_ves_auto:
        derived = derive_price_ves(p2, bcv)
        if derived is not None:
            p3 = derived
    return row.model_copy(update={"price_usd": p1, "price_usd_2": p2, "price_ves": p3})


def unit_price_for_sale(priced: ProductOut, currency: CurrencyCode) -> Decimal | None:
    if currency == CurrencyCode.VES:
        return priced.price_ves
    return Decimal(priced.price_usd)

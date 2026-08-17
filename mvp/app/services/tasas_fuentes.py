"""
Fuentes de tasas SPTCA / a2-buscador — portable (sin Django).
Adaptado en EnRutas: mismas URLs, payloads Binance, filtros Yadio y orden de fallback.

USD BCV: DolarApi → Dolitoday → ExchangeRate-API (opcional, EXCHANGERATE_API_KEY)
EUR BCV: DolarApi → ExchangeRate-API → Dolitoday
USDT:    promedio top N Binance P2P (merchant BUY) → Yadio (solo Binance P2P)

Uso:
    from tasas_fuentes import fetch_all
    print(fetch_all())
"""

from __future__ import annotations

import json
import logging
import os
import time
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Callable
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

CARACAS = ZoneInfo("America/Caracas")
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Defaults SPTCA
BINANCE_TOP_N = int(os.environ.get("BINANCE_TOP_N", "15"))
YADIO_TOP_N = int(os.environ.get("YADIO_TOP_N", "25"))
EXCHANGERATE_API_KEY = os.environ.get("EXCHANGERATE_API_KEY", "")


def configure(
    *,
    exchangerate_api_key: str | None = None,
    binance_top_n: int | None = None,
    yadio_top_n: int | None = None,
) -> None:
    """Inyecta settings de EnRutas sin cambiar el orden de fuentes."""
    global BINANCE_TOP_N, YADIO_TOP_N, EXCHANGERATE_API_KEY
    if exchangerate_api_key is not None:
        EXCHANGERATE_API_KEY = exchangerate_api_key
    if binance_top_n is not None:
        BINANCE_TOP_N = max(1, binance_top_n)
    if yadio_top_n is not None:
        YADIO_TOP_N = max(1, yadio_top_n)


@dataclass
class TasaFetch:
    valor: Decimal
    fuente: str
    fecha_fuente: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "valor": float(self.valor),
            "valor_str": f"{self.valor:.4f}".rstrip("0").rstrip(".")
            if "." in f"{self.valor:.4f}"
            else f"{self.valor:.4f}",
            "fuente": self.fuente,
            "fecha_fuente": self.fecha_fuente,
        }


def _http_json(
    url: str,
    *,
    method: str = "GET",
    body: dict | None = None,
    headers: dict | None = None,
    timeout: int = 20,
) -> dict:
    data = None
    req_headers = {
        "User-Agent": UA,
        "Accept": "application/json",
        "Cache-Control": "no-cache",
    }
    if headers:
        req_headers.update(headers)
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status}")
        return json.loads(resp.read().decode("utf-8"))


def _valid_rate(valor) -> Decimal | None:
    try:
        d = Decimal(str(valor))
    except Exception:
        return None
    if d <= 0 or d >= Decimal("1000000"):
        return None
    return d.quantize(Decimal("0.0001"))


def _promediar_precios(precios: list[float]) -> Decimal:
    avg = sum(precios) / len(precios)
    valor = _valid_rate(round(avg, 3))
    if valor is None:
        raise ValueError(f"promedio inválido: {avg}")
    return valor


def _first_valid(
    label: str, fuentes: list[tuple[str, Callable[[], TasaFetch]]]
) -> TasaFetch | None:
    for nombre, fn in fuentes:
        try:
            result = fn()
            if result and result.valor:
                logger.info("%s OK via %s = %s", label, result.fuente, result.valor)
                return result
            logger.warning("%s %s: valor inválido", label, nombre)
        except Exception as exc:
            logger.warning("%s %s: %s", label, nombre, exc)
    logger.error("%s: todas las fuentes fallaron", label)
    return None


# ─── USD BCV ───────────────────────────────────────────────────────────────


def _usd_bcv_dolarapi() -> TasaFetch:
    d = _http_json(
        f"https://ve.dolarapi.com/v1/dolares/oficial?_={int(datetime.now().timestamp())}"
    )
    valor = _valid_rate(d.get("promedio"))
    if valor is None:
        raise ValueError(f'promedio inválido: {d.get("promedio")}')
    return TasaFetch(
        valor, "DolarApi (BCV oficial)", str(d.get("fechaActualizacion") or "")
    )


def _usd_bcv_dolitoday() -> TasaFetch:
    d = _http_json(
        f"https://dolitoday.com/api/rate?_={int(datetime.now().timestamp())}"
    )
    valor = _valid_rate(d.get("bcv_rate"))
    if valor is None:
        raise ValueError(f'bcv_rate inválido: {d.get("bcv_rate")}')
    return TasaFetch(valor, "Dolitoday (BCV)", str(d.get("updated_at") or ""))


def _usd_bcv_exchangerate() -> TasaFetch:
    key = EXCHANGERATE_API_KEY
    if not key:
        raise RuntimeError("EXCHANGERATE_API_KEY no configurada")
    d = _http_json(f"https://v6.exchangerate-api.com/v6/{key}/pair/USD/VES")
    valor = _valid_rate(d.get("conversion_rate"))
    if valor is None:
        raise ValueError(f'conversion_rate inválido: {d.get("conversion_rate")}')
    return TasaFetch(valor, "ExchangeRate-API", datetime.now(CARACAS).isoformat())


def fetch_usd_bcv() -> TasaFetch | None:
    return _first_valid(
        "USD",
        [
            ("DolarApi", _usd_bcv_dolarapi),
            ("Dolitoday", _usd_bcv_dolitoday),
            ("ExchangeRate-API", _usd_bcv_exchangerate),
        ],
    )


# ─── EUR BCV ───────────────────────────────────────────────────────────────


def fetch_eur_bcv() -> TasaFetch | None:
    def dolarapi() -> TasaFetch:
        d = _http_json(
            f"https://ve.dolarapi.com/v1/euros/oficial?_={int(datetime.now().timestamp())}"
        )
        valor = _valid_rate(d.get("promedio"))
        if valor is None:
            raise ValueError(f'promedio inválido: {d.get("promedio")}')
        return TasaFetch(
            valor,
            "DolarApi (BCV EUR oficial)",
            str(d.get("fechaActualizacion") or ""),
        )

    def exchangerate() -> TasaFetch:
        key = EXCHANGERATE_API_KEY
        if not key:
            raise RuntimeError("EXCHANGERATE_API_KEY no configurada")
        d = _http_json(f"https://v6.exchangerate-api.com/v6/{key}/pair/EUR/VES")
        valor = _valid_rate(d.get("conversion_rate"))
        if valor is None:
            raise ValueError(f'conversion_rate inválido: {d.get("conversion_rate")}')
        return TasaFetch(
            valor, "ExchangeRate-API EUR", datetime.now(CARACAS).isoformat()
        )

    def dolitoday() -> TasaFetch:
        d = _http_json(
            f"https://dolitoday.com/api/rate?_={int(datetime.now().timestamp())}"
        )
        valor = _valid_rate(d.get("bcv_eur_rate"))
        if valor is None:
            raise ValueError(f'bcv_eur_rate inválido: {d.get("bcv_eur_rate")}')
        return TasaFetch(valor, "Dolitoday (BCV EUR)", str(d.get("updated_at") or ""))

    return _first_valid(
        "EUR",
        [
            ("DolarApi", dolarapi),
            ("ExchangeRate-API", exchangerate),
            ("Dolitoday", dolitoday),
        ],
    )


# ─── USDT (VES) ─────────────────────────────────────────────────────────────


def fetch_usdt() -> TasaFetch | None:
    def binance_p2p() -> TasaFetch:
        top_n = max(1, BINANCE_TOP_N)
        urls = [
            "https://www.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
            "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
        ]
        payload = {
            "asset": "USDT",
            "fiat": "VES",
            "tradeType": "BUY",
            "page": 1,
            "rows": top_n,
            "publisherType": "merchant",
        }
        headers = {
            "Accept-Language": "es-VE,es;q=0.9",
            "Origin": "https://p2p.binance.com",
            "Referer": "https://p2p.binance.com/",
            "clienttype": "web",
        }
        last_error: Exception | None = None
        for url in urls:
            for intento in range(3):
                if intento > 0:
                    time.sleep(intento)
                try:
                    d = _http_json(url, method="POST", body=payload, headers=headers)
                except Exception as exc:
                    last_error = exc
                    continue
                rows = d.get("data") or []
                if not rows:
                    last_error = ValueError("Sin anuncios P2P")
                    continue
                precios = []
                for row in rows:
                    adv = row.get("adv") or {}
                    try:
                        p = float(adv.get("price"))
                    except (TypeError, ValueError):
                        continue
                    if p > 0:
                        precios.append(p)
                if not precios:
                    last_error = ValueError("Precios inválidos")
                    continue
                valor = _promediar_precios(precios)
                return TasaFetch(
                    valor,
                    f"Binance P2P (promedio top {len(precios)} vendedores)",
                    datetime.now(CARACAS).isoformat(timespec="seconds"),
                )
        raise last_error or RuntimeError("Binance no respondió")

    def yadio_binance() -> TasaFetch:
        top_n = max(1, YADIO_TOP_N)
        limit_pedido = max(top_n * 2, 50)
        url = (
            "https://api.yadio.io/market/ads"
            f"?currency=VES&asset=USDT&side=buy&limit={limit_pedido}"
            f"&_={int(datetime.now().timestamp())}"
        )
        d = _http_json(url)
        ads = d.get("ads") or []
        if not ads:
            raise ValueError("Sin anuncios Yadio")
        precios: list[float] = []
        for ad in ads:
            if ad.get("exchange") != "Binance P2P":
                continue
            try:
                p = float(ad.get("price"))
            except (TypeError, ValueError):
                continue
            if p > 0:
                precios.append(p)
            if len(precios) >= top_n:
                break
        if not precios:
            raise ValueError("Sin anuncios Binance P2P en Yadio")
        valor = _promediar_precios(precios)
        fecha = ""
        if d.get("timestamp"):
            try:
                fecha = datetime.fromtimestamp(
                    d["timestamp"] / 1000, tz=CARACAS
                ).isoformat()
            except Exception:
                fecha = str(d.get("timestamp"))
        return TasaFetch(
            valor,
            f"Yadio (promedio top {len(precios)} Binance P2P)",
            fecha or datetime.now(CARACAS).isoformat(timespec="seconds"),
        )

    return _first_valid(
        "USDT",
        [
            ("Binance P2P", binance_p2p),
            ("Yadio Binance P2P", yadio_binance),
        ],
    )


# ─── API lista para UI ──────────────────────────────────────────────────────


def fetch_all() -> dict[str, Any]:
    """
    Snapshot listo para mostrar en UI.

    {
      "capturado_en": "...Caracas ISO...",
      "usd_bcv": { valor, fuente, fecha_fuente } | null,
      "eur_bcv": { ... } | null,
      "usdt": { ... } | null,
      "bs":  { ... }  // alias de usd_bcv (tasa Bs oficial BCV)
    }
    """
    usd = fetch_usd_bcv()
    eur = fetch_eur_bcv()
    usdt = fetch_usdt()
    return {
        "capturado_en": datetime.now(CARACAS).isoformat(timespec="seconds"),
        "usd_bcv": usd.to_dict() if usd else None,
        "eur_bcv": eur.to_dict() if eur else None,
        "usdt": usdt.to_dict() if usdt else None,
        # Alias útil si la otra app etiqueta la tarjeta como "BS" / "BCV"
        "bs": usd.to_dict() if usd else None,
    }


def ahora_caracas() -> datetime:
    return datetime.now(CARACAS)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    data = fetch_all()
    print(json.dumps(data, ensure_ascii=False, indent=2))

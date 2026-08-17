from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Bitácora Campo MVP"
    database_url: str = "postgresql+psycopg2://bitacora:bitacora@127.0.0.1:5432/bitacora_mvp"
    secret_key: str = "cambia-esto-en-produccion-bitacora-mvp"
    access_token_expire_minutes: int = 720
    algorithm: str = "HS256"
    # Orígenes del front Vite (coma-separados). En prod pondrás tu dominio.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Tasas VE (pack SPTCA). ExchangeRate-API es fallback opcional.
    exchangerate_api_key: str = ""
    binance_top_n: int = 15
    yadio_top_n: int = 25

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return origins or ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()

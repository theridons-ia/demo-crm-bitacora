from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Bitácora Campo MVP"
    database_url: str = "postgresql+psycopg2://bitacora:bitacora@127.0.0.1:5432/bitacora_mvp"
    secret_key: str = "cambia-esto-en-produccion-bitacora-mvp"
    access_token_expire_minutes: int = 720
    algorithm: str = "HS256"


@lru_cache
def get_settings() -> Settings:
    return Settings()

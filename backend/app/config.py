import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/kabaadlink")
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    default_radius_km: float = 5.0
    seed_demo_data: bool = True
    environment: str = os.getenv("ENVIRONMENT", "development")

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
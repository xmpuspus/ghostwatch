from __future__ import annotations

import os
import sys

from pydantic_settings import BaseSettings, SettingsConfigDict

# macOS Python doesn't use system CA certs — patch with certifi if available
if sys.platform == "darwin" and not os.environ.get("SSL_CERT_FILE"):
    try:
        import certifi

        os.environ["SSL_CERT_FILE"] = certifi.where()
    except ImportError:
        pass


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # data directories — try demo first, then processed
    data_dir: str = "data/processed"
    demo_data_dir: str = "data/demo"

    # Google Earth Engine credentials (satellite features degrade without these)
    gee_service_account: str = ""
    gee_key_file: str = ""

    cors_origins: str = "http://localhost:3000"

    # rate limiting (per IP, per minute)
    rate_limit_satellite: int = 30
    rate_limit_general: int = 60

    # admin API key for privileged operations
    admin_api_key: str = ""


settings = Settings()

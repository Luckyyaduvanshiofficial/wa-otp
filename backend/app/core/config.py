from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # PocketBase control plane (data store + auth source of truth)
    pb_url: str = "http://127.0.0.1:8090"
    pb_superuser_email: str = ""
    pb_superuser_password: str = ""

    # Prefix prepended to every wa-otp collection name (users -> waotp_users,
    # api_keys -> waotp_api_keys, ...) so this app can share one self-hosted
    # PocketBase instance with other projects (which may already own api_keys,
    # api_usage_logs, ...) without collection-name collisions. Set it to "" for
    # dedicated single-app deployments. The PB `users` auth collection and PB
    # system routes (_superusers auth, users auth-refresh) are never prefixed;
    # see scripts/provision_pb.py which creates the prefixed collections.
    pb_collections_prefix: str = Field(
        default="waotp_",
        validation_alias=AliasChoices(
            "pb_collections_prefix",  # default env name + .env key
            "waotp_pb_collections_prefix",  # WAOTP_-prefixed env variant
        ),
    )

    # Fernet key used to encrypt the Meta token at rest in the PB `settings` row.
    # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    waotp_fernet_key: str = ""

    # Shared secret Telegram echoes back in X-Telegram-Bot-Api-Secret-Token.
    # Must match the secret_token passed to setWebhook.
    telegram_webhook_secret: str = ""

    # CORS origin of the Next.js dashboard (leave empty in dev to allow all).
    dashboard_origin: str = ""

    # Dev-only: fake provider delivery so the full flow runs without Meta/Telegram credentials.
    waotp_mock_delivery: bool = False

    # Meta WhatsApp Cloud API credentials (fallbacks when not configured in PB settings)
    meta_phone_number_id: str = Field(
        default="",
        validation_alias=AliasChoices("meta_phone_number_id", "waotp_meta_phone_number_id"),
    )
    meta_waba_id: str = Field(
        default="",
        validation_alias=AliasChoices("meta_waba_id", "meta_business_account_id"),
    )
    meta_access_token: str = Field(
        default="",
        validation_alias=AliasChoices("meta_access_token", "meta_token", "waotp_meta_token"),
    )
    meta_template: str = "verification_code"
    meta_template_lang: str = "en_US"

    # Fallback limits; live values come from the PB `settings` collection.
    free_monthly_limit: int = 500
    per_phone_hourly: int = 5
    code_ttl_seconds: int = 300
    max_attempts: int = 3
    ratelimit_per_min: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()

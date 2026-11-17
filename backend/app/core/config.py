"""Application configuration using Pydantic settings."""

import base64
import re
from typing import Literal, Optional
from urllib.parse import urlsplit

from pydantic import AnyUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings


def _looks_like_der_key(material: bytes) -> bool:
    # DER public keys wrap an INTEGER or an algorithm identifier in a SEQUENCE.
    if material[0] != 0x30:
        return False
    length = material[1]
    if length < 0x80:
        return length == len(material) - 2 and material[2] in (0x02, 0x30)
    length_bytes = length & 0x7F
    start = 2 + length_bytes
    return (
        0 < length_bytes <= 4
        and start < len(material)
        and int.from_bytes(material[2:start], "big") == len(material) - start
        and material[start] in (0x02, 0x30)
    )


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    DATABASE_URL: AnyUrl

    # Security
    SECRET_KEY: str = Field(..., description="Dedicated JWT signing secret")
    ALGORITHM: Literal["HS256"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(30, ge=30, le=30)

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_signing_secret(cls, value: str) -> str:
        error = ValueError(
            "Use a dedicated JWT signing secret generated from at least 32 random bytes "
            "and encoded as hex or unpadded URL-safe base64."
        )
        if re.search(r"change[-_]?me|placeholder|your[-_]secret|replace[-_]this", value, re.I):
            raise error
        if re.fullmatch(r"[0-9a-fA-F]+", value):
            if len(value) % 2:
                raise error
            material = bytes.fromhex(value)
        elif re.fullmatch(r"[A-Za-z0-9_-]{43,}", value) and len(value) % 4 != 1:
            material = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
            if base64.urlsafe_b64encode(material).decode().rstrip("=") != value:
                raise error
        else:
            raise error

        # Reject obvious weak inputs. The operator must verify how the key was generated.
        if (
            len(material) < 32
            or all(32 <= byte <= 126 for byte in material)
            or len(set(material)) < 16
            or len({(right - left) % 256 for left, right in zip(material, material[1:])}) == 1
            or any(material[period:] == material[:-period] for period in range(1, len(material) // 2 + 1))
            or _looks_like_der_key(material)
        ):
            raise error
        # Keep the existing textual HMAC key so compatible HS256 tokens remain valid.
        return value

    LEGAL_AGGREGATOR_API_URL: str | None = None
    LEGAL_AGGREGATOR_API_KEY_HEADER: str | None = None
    AUTHORIZED_API_KEY1: SecretStr | None = None

    @field_validator("LEGAL_AGGREGATOR_API_URL")
    @classmethod
    def validate_aggregator_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip().rstrip("/")
        url = urlsplit(value)
        local = url.hostname in {"localhost", "127.0.0.1", "::1"}
        if (
            (url.scheme != "https" and not (url.scheme == "http" and local))
            or not url.hostname
            or url.username is not None
            or url.password is not None
            or "?" in value
            or "#" in value
            or url.path != "/api/v1"
            or re.search(r"[\s\\]", value)
            or (url.port is not None and not 1 <= url.port <= 65535)
        ):
            raise ValueError("Use an HTTPS aggregator base ending in /api/v1 (HTTP is allowed on loopback).")
        return value

    @model_validator(mode="after")
    def validate_aggregator_auth(self):
        header = self.LEGAL_AGGREGATOR_API_KEY_HEADER
        if header is None:
            return self
        if not re.fullmatch(r"(?:Authorization|API-Key|X-[A-Za-z0-9-]+)", header, re.IGNORECASE):
            raise ValueError("Use Authorization, API-Key or an X- header for legal aggregator authentication.")
        if not self.LEGAL_AGGREGATOR_API_URL or not self.LEGAL_AGGREGATOR_API_URL.startswith("https://"):
            raise ValueError("Authenticated legal aggregator requests require an HTTPS API URL.")
        key = self.AUTHORIZED_API_KEY1
        if key is None or not re.fullmatch(r"[!-~]+", key.get_secret_value()):
            raise ValueError("Set AUTHORIZED_API_KEY1 to a valid legal aggregator API key.")
        return self

    # Hosts for CORS - FRONTEND_HOST is required for production
    BACKEND_HOST: Optional[str] = Field(default=None, description="Backend host URL")
    FRONTEND_HOST: str = Field(..., description="Frontend host URL for CORS - required")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "hide_input_in_errors": True,
    }


settings = Settings()

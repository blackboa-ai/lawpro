"""Application configuration using Pydantic settings."""

import base64
import re
from typing import Literal, Optional

from pydantic import AnyUrl, Field, field_validator
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

    # Hosts for CORS - FRONTEND_HOST is required for production
    BACKEND_HOST: Optional[str] = Field(default=None, description="Backend host URL")
    FRONTEND_HOST: str = Field(..., description="Frontend host URL for CORS - required")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "hide_input_in_errors": True,
    }


settings = Settings()

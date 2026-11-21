"""User schemas for request/response validation."""

from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserBase(BaseModel):
    """Base user schema with common fields."""

    model_config = ConfigDict(from_attributes=True)
    
    email: EmailStr = Field(max_length=255)
    full_name: Optional[str] = Field(None, max_length=255)


class UserCreate(UserBase):
    """Schema for creating a new user."""

    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes")
        return value


class UserRead(UserBase):
    """Schema for reading user data."""

    id: int
    role: str
    is_active: bool


class UserUpdate(BaseModel):
    """Schema for updating user data."""

    model_config = ConfigDict(from_attributes=True)
    
    full_name: Optional[str] = Field(None, max_length=255)
    role: Optional[str] = None
    is_active: Optional[bool] = None


class Token(BaseModel):
    """Schema for authentication token response."""

    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for token payload data."""

    user_id: Optional[int] = None

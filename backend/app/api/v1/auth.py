"""Authentication endpoints."""

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.schemas import Token, UserCreate, UserRead

router = APIRouter()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate a password hash."""
    return pwd_context.hash(password)


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate) -> Any:
    """Register a new user."""
    # TODO: Implement actual registration with database
    # This is a placeholder that returns the user data
    return UserRead(
        id=1,
        email=user_in.email,
        full_name=user_in.full_name,
        role="advocate",
        is_active=True,
    )


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> Any:
    """Login endpoint returning JWT token."""
    # TODO: Validate credentials against database
    # This is a placeholder implementation
    fake_user_id = 1

    to_encode = {"sub": str(fake_user_id)}
    expire = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return Token(access_token=encoded_jwt, token_type="bearer")


@router.get("/me", response_model=UserRead)
async def read_current_user(token: str = Depends(oauth2_scheme)) -> Any:
    """Get current authenticated user."""
    # TODO: Implement token validation and user lookup
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Placeholder user
    return UserRead(
        id=1,
        email="demo@example.com",
        full_name="Demo User",
        role="advocate",
        is_active=True,
    )
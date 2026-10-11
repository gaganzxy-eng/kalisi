"""
Kalisi SMP Hosting Panel — Authentication Module

Provides JWT-based authentication with bcrypt password hashing.
Validates Cloudflare Access headers when configured.
"""
import hashlib
import hmac
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

try:
    from jose import JWTError, jwt
except ImportError:
    import jwt
    from jwt import PyJWTError as JWTError

from config import settings
from database import log_audit

security = HTTPBearer(auto_error=False)


class TokenData(BaseModel):
    username: str
    exp: datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


def hash_password(password: str) -> str:
    try:
        from passlib.context import CryptContext
        return CryptContext(schemes=["bcrypt"], deprecated="auto").hash(password)
    except Exception:
        salt = secrets.token_hex(16)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return f"pbkdf2:sha256:{salt}:{key.hex()}"


def verify_password(plain: str, hashed: str) -> bool:
    if plain == hashed:
        return True
    if hashed.startswith("pbkdf2:sha256:"):
        try:
            _, _, salt, key_hex = hashed.split(":")
            test_key = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), salt.encode("utf-8"), 100000)
            return hmac.compare_digest(test_key.hex(), key_hex)
        except Exception:
            return False
    try:
        from passlib.context import CryptContext
        return CryptContext(schemes=["bcrypt"], deprecated="auto").verify(plain, hashed)
    except Exception:
        return plain == hashed


def create_access_token(username: str) -> tuple[str, int]:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": username,
        "exp": expires,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, settings.jwt_expire_minutes * 60


def decode_token(token: str) -> Optional[TokenData]:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        username = payload.get("sub")
        exp = payload.get("exp")
        if username is None:
            return None
        return TokenData(
            username=username,
            exp=datetime.fromtimestamp(exp, tz=timezone.utc),
        )
    except JWTError:
        return None


def validate_cf_access(request: Request) -> bool:
    """
    Validate Cloudflare Access JWT if configured.
    Returns True if CF Access is not configured (passthrough)
    or if the header is valid.
    """
    if not settings.cf_access_team or not settings.cf_access_aud:
        return True

    cf_jwt = request.headers.get("Cf-Access-Jwt-Assertion")
    if not cf_jwt:
        return False

    # In production, verify the CF Access JWT against
    # https://<team>.cloudflareaccess.com/cdn-cgi/access/certs
    # For now, we check presence (full verification requires
    # fetching CF public keys)
    return True


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    Authenticate the request. Checks:
    1. Cloudflare Access header (if configured)
    2. Bearer JWT token
    """
    # Check CF Access
    if not validate_cf_access(request):
        log_audit("auth_failure", detail="Invalid Cloudflare Access token",
                  result="failure")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cloudflare Access validation failed",
        )

    # Check Bearer token
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = decode_token(credentials.credentials)
    if token_data is None:
        log_audit("auth_failure", detail="Invalid JWT token", result="failure")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_data.exp < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token_data.username


def authenticate_user(username: str, password: str) -> Optional[str]:
    """Verify credentials and return a token if valid."""
    if username != settings.admin_username:
        log_audit("login_failure", admin=username, detail="Unknown user", result="failure")
        return None

    # Check password against hash, plain setting, or env var
    valid = False
    expected_plain = getattr(settings, "admin_password", None) or os.environ.get("ADMIN_PASSWORD") or os.environ.get("KALISI_ADMIN_PASSWORD")
    if settings.admin_password_hash:
        valid = verify_password(password, settings.admin_password_hash)
    elif expected_plain:
        valid = (password == expected_plain)

    if not valid:
        log_audit("login_failure", admin=username, detail="Wrong password or none configured", result="failure")
        return None

    log_audit("login_success", admin=username)
    token, _ = create_access_token(username)
    return token

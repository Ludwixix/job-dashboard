"""
Basic security and authentication module.
"""
import hashlib
import os
import secrets
from datetime import datetime, timedelta

try:
    from jose import JWTError, jwt
    JOSE_AVAILABLE = True
except ImportError:
    JOSE_AVAILABLE = False
    print("Note: python-jose not installed. JWT tokens will be simulated.")

try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    PASSLIB_AVAILABLE = True
except ImportError:
    PASSLIB_AVAILABLE = False
    print("Note: passlib not installed. Password hashing will be simulated.")

from .logging import get_logger

logger = get_logger("job_dashboard.security")


class SecurityManager:
    """Simple security manager."""
    
    def __init__(self):
        self.secret_key = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
        self.algorithm = "HS256"
        logger.info("Security manager initialized")
    
    def hash_password(self, password: str) -> str:
        if PASSLIB_AVAILABLE:
            return pwd_context.hash(password)
        else:
            # Simple fallback - NOT SECURE for production!
            salt = secrets.token_hex(16)
            return f"simple:{salt}:{hashlib.sha256((password + salt).encode()).hexdigest()}"
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        if PASSLIB_AVAILABLE:
            return pwd_context.verify(plain_password, hashed_password)
        else:
            # Simple fallback verification
            if hashed_password.startswith("simple:"):
                parts = hashed_password.split(":")
                if len(parts) == 3:
                    _, salt, stored_hash = parts
                    computed_hash = hashlib.sha256((plain_password + salt).encode()).hexdigest()
                    return computed_hash == stored_hash
            return False
    
    def create_token(self, data: dict, expires_minutes: int = 30) -> str:
        if JOSE_AVAILABLE:
            to_encode = data.copy()
            expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
            to_encode.update({"exp": expire})
            return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        else:
            # Simple simulation
            import base64
            import json
            payload = {
                "data": data,
                "exp": (datetime.utcnow() + timedelta(minutes=expires_minutes)).timestamp(),
                "signature": hashlib.sha256(str(data).encode()).hexdigest()[:32]
            }
            return base64.b64encode(json.dumps(payload).encode()).decode()
    
    def verify_token(self, token: str) -> dict | None:
        if JOSE_AVAILABLE:
            try:
                return jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            except JWTError:
                return None
        else:
            # Simple simulation
            try:
                import base64
                import json
                from datetime import datetime
                payload = json.loads(base64.b64decode(token).decode())
                if payload.get("exp", 0) < datetime.utcnow().timestamp():
                    return None
                return payload.get("data")
            except Exception:
                return None


# Global instance
_security = None


def get_security() -> SecurityManager:
    global _security
    if _security is None:
        _security = SecurityManager()
    return _security
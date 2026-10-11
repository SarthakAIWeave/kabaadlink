from typing import Optional
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User


def get_actor(
    x_demo_user_id: Optional[str] = Header(None, alias="X-Demo-User-Id"),
    db: Session = Depends(get_db),
) -> User:
    """Validate and resolve the authenticated actor via X-Demo-User-Id header."""
    if not x_demo_user_id:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Missing X-Demo-User-Id header"},
        )

    try:
        user_id = int(x_demo_user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_IDENTITY", "message": "X-Demo-User-Id header must be a valid integer ID"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"code": "USER_NOT_FOUND", "message": f"User with id {user_id} not found in database"},
        )

    return user


def require_household(user: User = Depends(get_actor)) -> User:
    """Ensure the resolved actor has the HOUSEHOLD role."""
    if user.role != "HOUSEHOLD":
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "This operation requires a HOUSEHOLD role"},
        )
    return user


def require_vendor(user: User = Depends(get_actor)) -> User:
    """Ensure the resolved actor has the VENDOR role."""
    if user.role != "VENDOR":
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "This operation requires a VENDOR role"},
        )
    return user
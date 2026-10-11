from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional

from app.db import get_db
from app.models import User


def get_actor(
    x_demo_user_id: Optional[str] = Header(None, alias="X-Demo-User-Id"),
    db: Session = Depends(get_db)
) -> User:
    if not x_demo_user_id:
        raise HTTPException(
            status_code=401,
            detail={"code": "MISSING_IDENTITY", "message": "X-Demo-User-Id header is required"}
        )
    try:
        user_id = int(x_demo_user_id)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_IDENTITY", "message": "X-Demo-User-Id must be an integer"}
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"code": "USER_NOT_FOUND", "message": f"User with id {user_id} not found"}
        )
    return user


def require_household(user: User = Depends(get_actor)) -> User:
    if user.role != "HOUSEHOLD":
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "This action requires a household role"}
        )
    return user


def require_vendor(user: User = Depends(get_actor)) -> User:
    if user.role != "VENDOR":
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "This action requires a vendor role"}
        )
    return user
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import UserSummary

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.get("/users", response_model=List[UserSummary])
def list_demo_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id).all()
    return users
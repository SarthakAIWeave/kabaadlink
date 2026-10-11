from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ScrapRate
from app.schemas import ScrapRateSummary

router = APIRouter(prefix="/api", tags=["rates"])


@router.get("/rates", response_model=List[ScrapRateSummary])
def get_active_rates(db: Session = Depends(get_db)):
    rates = db.query(ScrapRate).filter(ScrapRate.is_active == True).order_by(ScrapRate.scrap_type).all()
    return rates
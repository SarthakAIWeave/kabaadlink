from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, Literal
from decimal import Decimal


class UserSummary(BaseModel):
    id: int
    name: str
    role: Literal["HOUSEHOLD", "VENDOR"]
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ScrapRateSummary(BaseModel):
    id: int
    scrap_type: str
    display_name: str
    rate_per_kg: Decimal
    currency: str

    model_config = ConfigDict(from_attributes=True)


class ScrapRequestSummary(BaseModel):
    id: int
    scrap_type: str
    quantity_kg: Decimal
    rate_per_kg: Decimal
    estimated_value: Decimal
    latitude: float
    longitude: float
    distance_km: Optional[float] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class ScrapRequestDetail(ScrapRequestSummary):
    address_note: Optional[str] = None
    household_id: int
    household_name: Optional[str] = None
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    final_weight_kg: Optional[Decimal] = None
    final_amount: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime
    claimed_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CreateRequestRequest(BaseModel):
    scrap_type: str = Field(..., min_length=1, max_length=50)
    quantity_kg: Decimal = Field(..., gt=Decimal("0.1"), le=Decimal("500"))
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address_note: Optional[str] = Field(None, max_length=200)


class CreateRequestResponse(BaseModel):
    id: int
    scrap_type: str
    quantity_kg: Decimal
    rate_per_kg: Decimal
    estimated_value: Decimal
    latitude: float
    longitude: float
    status: str
    distance_km: Optional[float] = None


class ClaimResponse(BaseModel):
    id: int
    status: str
    vendor_id: int
    claimed_at: datetime


class StatusUpdateRequest(BaseModel):
    final_weight_kg: Optional[Decimal] = Field(None, gt=Decimal("0"), le=Decimal("500"))


class StatusUpdateResponse(BaseModel):
    id: int
    status: str
    final_weight_kg: Optional[Decimal] = None
    final_amount: Optional[Decimal] = None
    updated_at: datetime


class ErrorResponse(BaseModel):
    error: "ErrorDetail"


class ErrorDetail(BaseModel):
    code: str
    message: str


class HealthResponse(BaseModel):
    status: str
    service: str = "kabaadlink-api"
    version: str = "1.0.0"


class PingResponse(BaseModel):
    pong: bool
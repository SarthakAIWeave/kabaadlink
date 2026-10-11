from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, Literal, List
from decimal import Decimal


class UserSummary(BaseModel):
    id: int
    name: str
    role: Literal["HOUSEHOLD", "VENDOR"]
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ScrapRateSummary(BaseModel):
    id: int
    scrap_type: str
    display_name: str
    rate_per_kg: Decimal
    currency: str = "INR"
    is_indicative: bool = True

    model_config = ConfigDict(from_attributes=True)


class RequestEventSummary(BaseModel):
    id: int
    request_id: int
    actor_id: Optional[int] = None
    event: str
    from_status: Optional[str] = None
    to_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScrapRequestSummary(BaseModel):
    id: int
    scrap_type: str
    quantity_kg: Decimal
    rate_per_kg: Decimal
    estimated_value: Decimal
    latitude: float
    longitude: float
    approx_latitude: Optional[float] = None
    approx_longitude: Optional[float] = None
    distance_km: Optional[float] = None
    status: str
    address_note: Optional[str] = None
    household_id: Optional[int] = None
    household_name: Optional[str] = None
    household_phone: Optional[str] = None
    vendor_id: Optional[int] = None
    vendor_name: Optional[str] = None
    vendor_phone: Optional[str] = None
    final_weight_kg: Optional[Decimal] = None
    final_amount: Optional[Decimal] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ScrapRequestDetail(ScrapRequestSummary):
    client_token: Optional[str] = None
    updated_at: Optional[datetime] = None
    claimed_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    events: List[RequestEventSummary] = []

    model_config = ConfigDict(from_attributes=True)


class CreateRequestRequest(BaseModel):
    scrap_type: str = Field(..., min_length=1, max_length=50)
    quantity_kg: Decimal = Field(..., ge=Decimal("0.1"), le=Decimal("500.0"))
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    address_note: Optional[str] = Field(None, max_length=200)
    client_token: Optional[str] = Field(None, max_length=100)


class CreateRequestResponse(BaseModel):
    id: int
    household_id: int
    scrap_type: str
    quantity_kg: Decimal
    rate_per_kg: Decimal
    estimated_value: Decimal
    latitude: float
    longitude: float
    address_note: Optional[str] = None
    status: str
    created_at: datetime
    distance_km: Optional[float] = None


class ClaimResponse(BaseModel):
    id: int
    status: str
    vendor_id: int
    claimed_at: datetime


class StatusUpdateRequest(BaseModel):
    final_weight_kg: Optional[Decimal] = Field(None, ge=Decimal("0.1"), le=Decimal("500.0"))


class StatusUpdateResponse(BaseModel):
    id: int
    status: str
    final_weight_kg: Optional[Decimal] = None
    final_amount: Optional[Decimal] = None
    updated_at: datetime


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[List[dict]] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class HealthResponse(BaseModel):
    status: str
    service: str = "kabaadlink-api"
    version: str = "1.0.0"


class PingResponse(BaseModel):
    pong: bool
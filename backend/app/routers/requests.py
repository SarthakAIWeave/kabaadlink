from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import update, func, and_
from decimal import Decimal
from typing import Optional, List

from app.db import get_db
from app.models import User, ScrapRate, ScrapRequest
from app.schemas import (
    ScrapRequestSummary,
    ScrapRequestDetail,
    CreateRequestRequest,
    CreateRequestResponse,
    ClaimResponse,
    StatusUpdateRequest,
    StatusUpdateResponse,
)
from app.deps import get_actor, require_household, require_vendor
from app.geo import haversine_km, bounding_box, round_distance, round_coords
from app.config import settings

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.get("/nearby", response_model=List[ScrapRequestSummary])
def get_nearby_requests(
    lat: float = Query(..., ge=-90, le=90, description="Vendor latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Vendor longitude"),
    radius_km: float = Query(settings.default_radius_km, ge=0.5, le=50, description="Search radius in km"),
    db: Session = Depends(get_db),
):
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius_km)

    requests = (
        db.query(ScrapRequest)
        .filter(
            ScrapRequest.status == "OPEN",
            ScrapRequest.latitude.between(min_lat, max_lat),
            ScrapRequest.longitude.between(min_lng, max_lng),
        )
        .order_by(ScrapRequest.created_at.desc())
        .all()
    )

    results = []
    for req in requests:
        distance = haversine_km(lat, lng, float(req.latitude), float(req.longitude))
        if distance <= radius_km:
            approx_lat, approx_lng = round_coords(float(req.latitude), float(req.longitude))
            results.append(
                ScrapRequestSummary(
                    id=req.id,
                    scrap_type=req.scrap_type,
                    quantity_kg=req.quantity_kg,
                    rate_per_kg=req.rate_per_kg,
                    estimated_value=req.estimated_value,
                    latitude=approx_lat,
                    longitude=approx_lng,
                    distance_km=round_distance(distance),
                    status=req.status,
                )
            )

    results.sort(key=lambda x: x.distance_km or float("inf"))
    return results


@router.get("/mine", response_model=List[ScrapRequestSummary])
def get_my_requests(
    user: User = Depends(get_actor),
    db: Session = Depends(get_db),
):
    if user.role == "HOUSEHOLD":
        requests = db.query(ScrapRequest).filter(ScrapRequest.household_id == user.id).order_by(ScrapRequest.created_at.desc()).all()
    else:
        requests = db.query(ScrapRequest).filter(ScrapRequest.vendor_id == user.id).order_by(ScrapRequest.created_at.desc()).all()

    return [
        ScrapRequestSummary(
            id=req.id,
            scrap_type=req.scrap_type,
            quantity_kg=req.quantity_kg,
            rate_per_kg=req.rate_per_kg,
            estimated_value=req.estimated_value,
            latitude=float(req.latitude),
            longitude=float(req.longitude),
            status=req.status,
        )
        for req in requests
    ]


@router.post("", response_model=CreateRequestResponse, status_code=201)
def create_request(
    payload: CreateRequestRequest,
    user: User = Depends(require_household),
    db: Session = Depends(get_db),
):
    rate = db.query(ScrapRate).filter(
        ScrapRate.scrap_type == payload.scrap_type,
        ScrapRate.is_active == True,
    ).first()

    if not rate:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_SCRAP_TYPE", "message": f"Unknown scrap type: {payload.scrap_type}"}
        )

    estimated_value = float(payload.quantity_kg) * float(rate.rate_per_kg)

    request = ScrapRequest(
        household_id=user.id,
        scrap_type=payload.scrap_type,
        quantity_kg=payload.quantity_kg,
        rate_per_kg=rate.rate_per_kg,
        estimated_value=estimated_value,
        latitude=payload.latitude,
        longitude=payload.longitude,
        address_note=payload.address_note,
        status="OPEN",
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    return CreateRequestResponse(
        id=request.id,
        scrap_type=request.scrap_type,
        quantity_kg=request.quantity_kg,
        rate_per_kg=request.rate_per_kg,
        estimated_value=request.estimated_value,
        latitude=float(request.latitude),
        longitude=float(request.longitude),
        status=request.status,
    )


@router.get("/{request_id}", response_model=ScrapRequestDetail)
def get_request(
    request_id: int,
    user: User = Depends(get_actor),
    db: Session = Depends(get_db),
):
    request = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Request not found"}
        )

    is_owner = request.household_id == user.id
    is_vendor = request.vendor_id == user.id

    if not (is_owner or is_vendor):
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Not authorized to view this request"}
        )

    household = db.query(User).filter(User.id == request.household_id).first()
    vendor = db.query(User).filter(User.id == request.vendor_id).first() if request.vendor_id else None

    return ScrapRequestDetail(
        id=request.id,
        scrap_type=request.scrap_type,
        quantity_kg=request.quantity_kg,
        rate_per_kg=request.rate_per_kg,
        estimated_value=request.estimated_value,
        latitude=float(request.latitude),
        longitude=float(request.longitude),
        address_note=request.address_note if (is_owner or is_vendor) else None,
        household_id=request.household_id,
        household_name=household.name if household else None,
        vendor_id=request.vendor_id,
        vendor_name=vendor.name if vendor else None,
        final_weight_kg=request.final_weight_kg,
        final_amount=request.final_amount,
        status=request.status,
        created_at=request.created_at,
        updated_at=request.updated_at,
        claimed_at=request.claimed_at,
        picked_up_at=request.picked_up_at,
        completed_at=request.completed_at,
        cancelled_at=request.cancelled_at,
    )


@router.post("/{request_id}/claim", response_model=ClaimResponse)
def claim_request(
    request_id: int,
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    request = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Request not found"}
        )

    if request.status != "OPEN":
        raise HTTPException(
            status_code=409,
            detail={"code": "ALREADY_CLAIMED", "message": "This request was just claimed by another vendor."}
        )

    result = db.execute(
        update(ScrapRequest)
        .where(
            ScrapRequest.id == request_id,
            ScrapRequest.status == "OPEN"
        )
        .values(
            status="CLAIMED",
            vendor_id=user.id,
            claimed_at=func.now(),
            updated_at=func.now()
        )
    )
    db.commit()

    if result.rowcount == 0:
        fresh_request = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
        if fresh_request and fresh_request.status != "OPEN":
            raise HTTPException(
                status_code=409,
                detail={"code": "ALREADY_CLAIMED", "message": "This request was just claimed by another vendor."}
            )
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Request not found"}
        )

    db.refresh(request)
    return ClaimResponse(
        id=request.id,
        status=request.status,
        vendor_id=request.vendor_id,
        claimed_at=request.claimed_at,
    )


@router.post("/{request_id}/release", response_model=StatusUpdateResponse)
def release_request(
    request_id: int,
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    request = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Request not found"}
        )

    if request.vendor_id != user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Only the assigned vendor can release this request"}
        )

    if request.status != "CLAIMED":
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_TRANSITION", "message": f"Cannot release request with status {request.status}"}
        )

    request.status = "OPEN"
    request.vendor_id = None
    request.claimed_at = None
    request.updated_at = func.now()
    db.commit()
    db.refresh(request)

    return StatusUpdateResponse(
        id=request.id,
        status=request.status,
        updated_at=request.updated_at,
    )


@router.post("/{request_id}/cancel", response_model=StatusUpdateResponse)
def cancel_request(
    request_id: int,
    user: User = Depends(require_household),
    db: Session = Depends(get_db),
):
    request = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Request not found"}
        )

    if request.household_id != user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Only the household owner can cancel this request"}
        )

    if request.status not in ("OPEN", "CLAIMED"):
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_TRANSITION", "message": f"Cannot cancel request with status {request.status}"}
        )

    request.status = "CANCELLED"
    request.cancelled_at = func.now()
    request.updated_at = func.now()
    db.commit()
    db.refresh(request)

    return StatusUpdateResponse(
        id=request.id,
        status=request.status,
        updated_at=request.updated_at,
    )


@router.post("/{request_id}/pickup", response_model=StatusUpdateResponse)
def pickup_request(
    request_id: int,
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    request = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Request not found"}
        )

    if request.vendor_id != user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Only the assigned vendor can mark pickup"}
        )

    if request.status != "CLAIMED":
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_TRANSITION", "message": f"Cannot mark pickup for request with status {request.status}"}
        )

    request.status = "PICKED_UP"
    request.picked_up_at = func.now()
    request.updated_at = func.now()
    db.commit()
    db.refresh(request)

    return StatusUpdateResponse(
        id=request.id,
        status=request.status,
        updated_at=request.updated_at,
    )


@router.post("/{request_id}/complete", response_model=StatusUpdateResponse)
def complete_request(
    request_id: int,
    payload: StatusUpdateRequest,
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    request = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Request not found"}
        )

    if request.vendor_id != user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Only the assigned vendor can complete this request"}
        )

    if request.status != "PICKED_UP":
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_TRANSITION", "message": f"Cannot complete request with status {request.status}"}
        )

    final_weight = payload.final_weight_kg or request.quantity_kg
    final_amount = float(final_weight) * float(request.rate_per_kg)

    request.status = "COMPLETED"
    request.final_weight_kg = final_weight
    request.final_amount = final_amount
    request.completed_at = func.now()
    request.updated_at = func.now()
    db.commit()
    db.refresh(request)

    return StatusUpdateResponse(
        id=request.id,
        status=request.status,
        final_weight_kg=request.final_weight_kg,
        final_amount=request.final_amount,
        updated_at=request.updated_at,
    )
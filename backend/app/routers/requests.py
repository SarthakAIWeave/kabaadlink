from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import update, func, and_
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List

from app.db import get_db
from app.models import User, ScrapRate, ScrapRequest, RequestEvent
from app.schemas import (
    ScrapRequestSummary,
    ScrapRequestDetail,
    RequestEventSummary,
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
    """Return all open requests within radius with obfuscated coordinates for privacy."""
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
                    approx_latitude=approx_lat,
                    approx_longitude=approx_lng,
                    distance_km=round_distance(distance),
                    status=req.status,
                    created_at=req.created_at,
                )
            )

    results.sort(key=lambda x: x.distance_km if x.distance_km is not None else float("inf"))
    return results


@router.get("/mine", response_model=List[ScrapRequestSummary])
def get_my_requests(
    user: User = Depends(get_actor),
    db: Session = Depends(get_db),
):
    """Return requests belonging to the authenticated actor with full details."""
    if user.role == "HOUSEHOLD":
        requests = (
            db.query(ScrapRequest)
            .filter(ScrapRequest.household_id == user.id)
            .order_by(ScrapRequest.created_at.desc())
            .all()
        )
    else:
        requests = (
            db.query(ScrapRequest)
            .filter(ScrapRequest.vendor_id == user.id)
            .order_by(ScrapRequest.created_at.desc())
            .all()
        )

    results = []
    for req in requests:
        h_name = req.household.name if req.household else None
        h_phone = req.household.phone if req.household else None
        v_name = req.vendor.name if req.vendor else None
        v_phone = req.vendor.phone if req.vendor else None

        results.append(
            ScrapRequestSummary(
                id=req.id,
                scrap_type=req.scrap_type,
                quantity_kg=req.quantity_kg,
                rate_per_kg=req.rate_per_kg,
                estimated_value=req.estimated_value,
                latitude=float(req.latitude),
                longitude=float(req.longitude),
                status=req.status,
                address_note=req.address_note,
                household_id=req.household_id,
                household_name=h_name,
                household_phone=h_phone,
                vendor_id=req.vendor_id,
                vendor_name=v_name,
                vendor_phone=v_phone,
                final_weight_kg=req.final_weight_kg,
                final_amount=req.final_amount,
                created_at=req.created_at,
            )
        )
    return results


@router.post("", response_model=CreateRequestResponse, status_code=201)
def create_request(
    payload: CreateRequestRequest,
    user: User = Depends(require_household),
    db: Session = Depends(get_db),
):
    """Idempotently create a new scrap request and record the initial CREATED event."""
    # Check idempotency token
    if payload.client_token:
        existing = (
            db.query(ScrapRequest)
            .filter(
                ScrapRequest.household_id == user.id,
                ScrapRequest.client_token == payload.client_token,
            )
            .first()
        )
        if existing:
            return CreateRequestResponse(
                id=existing.id,
                household_id=existing.household_id,
                scrap_type=existing.scrap_type,
                quantity_kg=existing.quantity_kg,
                rate_per_kg=existing.rate_per_kg,
                estimated_value=existing.estimated_value,
                latitude=float(existing.latitude),
                longitude=float(existing.longitude),
                address_note=existing.address_note,
                status=existing.status,
                created_at=existing.created_at,
            )

    rate = (
        db.query(ScrapRate)
        .filter(
            ScrapRate.scrap_type == payload.scrap_type,
            ScrapRate.is_active == True,
        )
        .first()
    )

    if not rate:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_SCRAP_TYPE", "message": f"Active rate not found for: {payload.scrap_type}"},
        )

    # Quantize estimated_value to 0.01 using ROUND_HALF_UP
    qty = Decimal(str(payload.quantity_kg))
    r_kg = Decimal(str(rate.rate_per_kg))
    estimated_value = (qty * r_kg).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    request = ScrapRequest(
        household_id=user.id,
        scrap_type=payload.scrap_type,
        quantity_kg=payload.quantity_kg,
        rate_per_kg=rate.rate_per_kg,
        estimated_value=estimated_value,
        latitude=payload.latitude,
        longitude=payload.longitude,
        address_note=payload.address_note,
        client_token=payload.client_token,
        status="OPEN",
    )
    db.add(request)
    db.flush()

    # Record CREATED event
    event = RequestEvent(
        request_id=request.id,
        actor_id=user.id,
        event="CREATED",
        from_status=None,
        to_status="OPEN",
    )
    db.add(event)
    db.commit()
    db.refresh(request)

    return CreateRequestResponse(
        id=request.id,
        household_id=request.household_id,
        scrap_type=request.scrap_type,
        quantity_kg=request.quantity_kg,
        rate_per_kg=request.rate_per_kg,
        estimated_value=request.estimated_value,
        latitude=float(request.latitude),
        longitude=float(request.longitude),
        address_note=request.address_note,
        status=request.status,
        created_at=request.created_at,
    )


@router.get("/{request_id}", response_model=ScrapRequestDetail)
def get_request(
    request_id: int,
    user: User = Depends(get_actor),
    db: Session = Depends(get_db),
):
    """Retrieve full request detail including audit timeline."""
    request = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    if not request:
        raise HTTPException(
            status_code=404,
            detail={"code": "REQUEST_NOT_FOUND", "message": "Request not found"},
        )

    is_owner = request.household_id == user.id
    is_assigned_vendor = request.vendor_id == user.id
    is_open_and_vendor = request.status == "OPEN" and user.role == "VENDOR"

    if not (is_owner or is_assigned_vendor or is_open_and_vendor):
        raise HTTPException(
            status_code=403,
            detail={"code": "FORBIDDEN", "message": "Not authorized to view this request"},
        )

    household = db.query(User).filter(User.id == request.household_id).first()
    vendor = db.query(User).filter(User.id == request.vendor_id).first() if request.vendor_id else None

    # Privacy masking for unassigned vendors browsing open requests
    lat = float(request.latitude)
    lng = float(request.longitude)
    address_note = request.address_note
    household_name = household.name if household else None
    household_phone = household.phone if household else None

    if is_open_and_vendor and not is_owner:
        lat, lng = round_coords(lat, lng)
        address_note = "Available upon claim"
        household_phone = None

    events = [
        RequestEventSummary(
            id=e.id,
            request_id=e.request_id,
            actor_id=e.actor_id,
            event=e.event,
            from_status=e.from_status,
            to_status=e.to_status,
            created_at=e.created_at,
        )
        for e in request.events
    ]

    return ScrapRequestDetail(
        id=request.id,
        scrap_type=request.scrap_type,
        quantity_kg=request.quantity_kg,
        rate_per_kg=request.rate_per_kg,
        estimated_value=request.estimated_value,
        latitude=lat,
        longitude=lng,
        address_note=address_note,
        client_token=request.client_token if is_owner else None,
        household_id=request.household_id,
        household_name=household_name,
        household_phone=household_phone,
        vendor_id=request.vendor_id,
        vendor_name=vendor.name if vendor else None,
        vendor_phone=vendor.phone if vendor else None,
        final_weight_kg=request.final_weight_kg,
        final_amount=request.final_amount,
        status=request.status,
        created_at=request.created_at,
        updated_at=request.updated_at,
        claimed_at=request.claimed_at,
        picked_up_at=request.picked_up_at,
        completed_at=request.completed_at,
        cancelled_at=request.cancelled_at,
        events=events,
    )


@router.post("/{request_id}/claim", response_model=ClaimResponse)
def claim_request(
    request_id: int,
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Atomically claim an open request using a conditional single UPDATE."""
    result = db.execute(
        update(ScrapRequest)
        .where(
            ScrapRequest.id == request_id,
            ScrapRequest.status == "OPEN",
        )
        .values(
            status="CLAIMED",
            vendor_id=user.id,
            claimed_at=func.now(),
            updated_at=func.now(),
        )
    )

    if result.rowcount == 0:
        db.rollback()
        fresh = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
        if not fresh:
            raise HTTPException(
                status_code=404,
                detail={"code": "REQUEST_NOT_FOUND", "message": "Request not found"},
            )
        raise HTTPException(
            status_code=409,
            detail={"code": "ALREADY_CLAIMED", "message": "This request was just claimed by another vendor."},
        )

    # Insert audit event
    event = RequestEvent(
        request_id=request_id,
        actor_id=user.id,
        event="CLAIMED",
        from_status="OPEN",
        to_status="CLAIMED",
    )
    db.add(event)
    db.commit()

    claimed_req = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    return ClaimResponse(
        id=claimed_req.id,
        status=claimed_req.status,
        vendor_id=claimed_req.vendor_id,
        claimed_at=claimed_req.claimed_at,
    )


@router.post("/{request_id}/release", response_model=StatusUpdateResponse)
def release_request(
    request_id: int,
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Release a claimed request back to OPEN."""
    result = db.execute(
        update(ScrapRequest)
        .where(
            ScrapRequest.id == request_id,
            ScrapRequest.status == "CLAIMED",
            ScrapRequest.vendor_id == user.id,
        )
        .values(
            status="OPEN",
            vendor_id=None,
            claimed_at=None,
            updated_at=func.now(),
        )
    )

    if result.rowcount == 0:
        db.rollback()
        req = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
        if not req:
            raise HTTPException(status_code=404, detail={"code": "REQUEST_NOT_FOUND", "message": "Request not found"})
        if req.vendor_id != user.id:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only assigned vendor can release"})
        raise HTTPException(status_code=400, detail={"code": "INVALID_TRANSITION", "message": f"Cannot release with status {req.status}"})

    event = RequestEvent(
        request_id=request_id,
        actor_id=user.id,
        event="RELEASED",
        from_status="CLAIMED",
        to_status="OPEN",
    )
    db.add(event)
    db.commit()

    req = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    return StatusUpdateResponse(
        id=req.id,
        status=req.status,
        updated_at=req.updated_at,
    )


@router.post("/{request_id}/pickup", response_model=StatusUpdateResponse)
def pickup_request(
    request_id: int,
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Advance status from CLAIMED to PICKED_UP."""
    result = db.execute(
        update(ScrapRequest)
        .where(
            ScrapRequest.id == request_id,
            ScrapRequest.status == "CLAIMED",
            ScrapRequest.vendor_id == user.id,
        )
        .values(
            status="PICKED_UP",
            picked_up_at=func.now(),
            updated_at=func.now(),
        )
    )

    if result.rowcount == 0:
        db.rollback()
        req = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
        if not req:
            raise HTTPException(status_code=404, detail={"code": "REQUEST_NOT_FOUND", "message": "Request not found"})
        if req.vendor_id != user.id:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only assigned vendor can mark pickup"})
        raise HTTPException(status_code=400, detail={"code": "INVALID_TRANSITION", "message": f"Cannot pickup with status {req.status}"})

    event = RequestEvent(
        request_id=request_id,
        actor_id=user.id,
        event="PICKED_UP",
        from_status="CLAIMED",
        to_status="PICKED_UP",
    )
    db.add(event)
    db.commit()

    req = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    return StatusUpdateResponse(
        id=req.id,
        status=req.status,
        updated_at=req.updated_at,
    )


@router.post("/{request_id}/complete", response_model=StatusUpdateResponse)
def complete_request(
    request_id: int,
    payload: StatusUpdateRequest,
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Settle final weight and amount, transitioning from PICKED_UP to COMPLETED."""
    req = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail={"code": "REQUEST_NOT_FOUND", "message": "Request not found"})
    if req.vendor_id != user.id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only assigned vendor can complete"})
    if req.status != "PICKED_UP":
        raise HTTPException(status_code=400, detail={"code": "INVALID_TRANSITION", "message": f"Cannot complete with status {req.status}"})

    final_weight = payload.final_weight_kg if payload.final_weight_kg is not None else req.quantity_kg
    w_dec = Decimal(str(final_weight))
    r_dec = Decimal(str(req.rate_per_kg))
    final_amount = (w_dec * r_dec).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    result = db.execute(
        update(ScrapRequest)
        .where(
            ScrapRequest.id == request_id,
            ScrapRequest.status == "PICKED_UP",
            ScrapRequest.vendor_id == user.id,
        )
        .values(
            status="COMPLETED",
            final_weight_kg=final_weight,
            final_amount=final_amount,
            completed_at=func.now(),
            updated_at=func.now(),
        )
    )

    if result.rowcount == 0:
        db.rollback()
        raise HTTPException(status_code=400, detail={"code": "CONCURRENT_CONFLICT", "message": "Update failed"})

    event = RequestEvent(
        request_id=request_id,
        actor_id=user.id,
        event="COMPLETED",
        from_status="PICKED_UP",
        to_status="COMPLETED",
    )
    db.add(event)
    db.commit()

    updated = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    return StatusUpdateResponse(
        id=updated.id,
        status=updated.status,
        final_weight_kg=updated.final_weight_kg,
        final_amount=updated.final_amount,
        updated_at=updated.updated_at,
    )


@router.post("/{request_id}/cancel", response_model=StatusUpdateResponse)
def cancel_request(
    request_id: int,
    user: User = Depends(require_household),
    db: Session = Depends(get_db),
):
    """Household cancels request while in OPEN or CLAIMED status."""
    req = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail={"code": "REQUEST_NOT_FOUND", "message": "Request not found"})
    if req.household_id != user.id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only household owner can cancel"})
    if req.status not in ("OPEN", "CLAIMED"):
        raise HTTPException(status_code=400, detail={"code": "INVALID_TRANSITION", "message": f"Cannot cancel request with status {req.status}"})

    old_status = req.status
    result = db.execute(
        update(ScrapRequest)
        .where(
            ScrapRequest.id == request_id,
            ScrapRequest.household_id == user.id,
            ScrapRequest.status.in_(["OPEN", "CLAIMED"]),
        )
        .values(
            status="CANCELLED",
            cancelled_at=func.now(),
            updated_at=func.now(),
        )
    )

    if result.rowcount == 0:
        db.rollback()
        raise HTTPException(status_code=400, detail={"code": "CONCURRENT_CONFLICT", "message": "Cancel failed"})

    event = RequestEvent(
        request_id=request_id,
        actor_id=user.id,
        event="CANCELLED",
        from_status=old_status,
        to_status="CANCELLED",
    )
    db.add(event)
    db.commit()

    updated = db.query(ScrapRequest).filter(ScrapRequest.id == request_id).first()
    return StatusUpdateResponse(
        id=updated.id,
        status=updated.status,
        updated_at=updated.updated_at,
    )
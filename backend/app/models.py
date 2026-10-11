from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    BigInteger,
    Integer,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# Cross-compatible 64-bit integer ID type: BIGINT in PostgreSQL, INTEGER in SQLite (rowid)
PK_BIGINT = BigInteger().with_variant(Integer, "sqlite")
FK_BIGINT = BigInteger().with_variant(Integer, "sqlite")


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(PK_BIGINT, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    household_requests: Mapped[List["ScrapRequest"]] = relationship(
        "ScrapRequest",
        foreign_keys="ScrapRequest.household_id",
        back_populates="household",
    )
    vendor_requests: Mapped[List["ScrapRequest"]] = relationship(
        "ScrapRequest",
        foreign_keys="ScrapRequest.vendor_id",
        back_populates="vendor",
    )

    __table_args__ = (
        CheckConstraint("role IN ('HOUSEHOLD', 'VENDOR')", name="ck_users_role"),
    )


class ScrapRate(Base):
    __tablename__ = "scrap_rates"

    id: Mapped[int] = mapped_column(PK_BIGINT, primary_key=True, autoincrement=True)
    scrap_type: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    rate_per_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        CheckConstraint("rate_per_kg > 0", name="ck_scrap_rates_rate_positive"),
    )


class ScrapRequest(Base):
    __tablename__ = "scrap_requests"

    id: Mapped[int] = mapped_column(PK_BIGINT, primary_key=True, autoincrement=True)
    household_id: Mapped[int] = mapped_column(FK_BIGINT, ForeignKey("users.id"), nullable=False)
    vendor_id: Mapped[Optional[int]] = mapped_column(FK_BIGINT, ForeignKey("users.id"), nullable=True)
    scrap_type: Mapped[str] = mapped_column(Text, nullable=False)
    quantity_kg: Mapped[float] = mapped_column(Numeric(8, 3), nullable=False)
    rate_per_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    estimated_value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    address_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="OPEN")
    client_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    final_weight_kg: Mapped[Optional[float]] = mapped_column(Numeric(8, 3), nullable=True)
    final_amount: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    picked_up_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    household: Mapped["User"] = relationship(
        "User", foreign_keys=[household_id], back_populates="household_requests"
    )
    vendor: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[vendor_id], back_populates="vendor_requests"
    )
    events: Mapped[List["RequestEvent"]] = relationship(
        "RequestEvent",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="RequestEvent.created_at.asc()",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('OPEN', 'CLAIMED', 'PICKED_UP', 'COMPLETED', 'CANCELLED')",
            name="ck_scrap_requests_status",
        ),
        CheckConstraint(
            "quantity_kg >= 0.1 AND quantity_kg <= 500",
            name="ck_scrap_requests_quantity_range",
        ),
        CheckConstraint(
            "latitude >= -90 AND latitude <= 90",
            name="ck_scrap_requests_lat_range",
        ),
        CheckConstraint(
            "longitude >= -180 AND longitude <= 180",
            name="ck_scrap_requests_lng_range",
        ),
        CheckConstraint(
            "status != 'OPEN' OR vendor_id IS NULL",
            name="ck_scrap_requests_open_vendor_null",
        ),
        CheckConstraint(
            "status NOT IN ('CLAIMED', 'PICKED_UP', 'COMPLETED') OR vendor_id IS NOT NULL",
            name="ck_scrap_requests_claimed_vendor_not_null",
        ),
        CheckConstraint(
            "status != 'COMPLETED' OR (final_weight_kg IS NOT NULL AND final_amount IS NOT NULL)",
            name="ck_scrap_requests_completed_final",
        ),
        Index("ix_scrap_requests_status_created", "status", "created_at"),
        Index("ix_scrap_requests_household_id", "household_id"),
        Index("ix_scrap_requests_vendor_id", "vendor_id"),
        Index("ix_scrap_requests_client_token", "household_id", "client_token"),
    )


class RequestEvent(Base):
    __tablename__ = "request_events"

    id: Mapped[int] = mapped_column(PK_BIGINT, primary_key=True, autoincrement=True)
    request_id: Mapped[int] = mapped_column(
        FK_BIGINT, ForeignKey("scrap_requests.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[Optional[int]] = mapped_column(FK_BIGINT, ForeignKey("users.id"), nullable=True)
    event: Mapped[str] = mapped_column(Text, nullable=False)
    from_status: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    to_status: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    request: Mapped["ScrapRequest"] = relationship("ScrapRequest", back_populates="events")
    actor: Mapped[Optional["User"]] = relationship("User")

    __table_args__ = (
        Index("ix_request_events_request_id", "request_id"),
    )
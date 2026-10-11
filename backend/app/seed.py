import logging
from sqlalchemy.orm import Session
from app.models import User, ScrapRate, ScrapRequest, RequestEvent
from app.config import settings

logger = logging.getLogger(__name__)

DEMO_RATES = [
    {"scrap_type": "newspaper", "display_name": "Newspaper", "rate_per_kg": 15.00},
    {"scrap_type": "cardboard", "display_name": "Cardboard", "rate_per_kg": 8.00},
    {"scrap_type": "plastic", "display_name": "Plastic", "rate_per_kg": 10.00},
    {"scrap_type": "iron", "display_name": "Iron", "rate_per_kg": 25.00},
    {"scrap_type": "aluminium", "display_name": "Aluminium", "rate_per_kg": 80.00},
]

DEMO_USERS = [
    {
        "id": 1,
        "name": "Priya Sharma",
        "role": "HOUSEHOLD",
        "phone": "+91 98765 43210",
        "latitude": 28.6139,
        "longitude": 77.2090,
    },
    {
        "id": 2,
        "name": "Rohan Verma",
        "role": "HOUSEHOLD",
        "phone": "+91 98111 22334",
        "latitude": 28.6200,
        "longitude": 77.2150,
    },
    {
        "id": 3,
        "name": "Ramesh Scrap Store",
        "role": "VENDOR",
        "phone": "+91 98999 11223",
        "latitude": 28.6180,
        "longitude": 77.2050,
    },
    {
        "id": 4,
        "name": "GreenRecycle Vendors",
        "role": "VENDOR",
        "phone": "+91 98222 33445",
        "latitude": 28.6100,
        "longitude": 77.2120,
    },
    {
        "id": 5,
        "name": "Sharma Kabadiwala",
        "role": "VENDOR",
        "phone": "+91 98333 44556",
        "latitude": 28.6220,
        "longitude": 77.2180,
    },
]


def seed_database(db: Session) -> None:
    """Seed demo rates, users, and initial requests idempotently if database is empty."""
    if db.query(User).first() is not None:
        logger.info("Database already contains users. Skipping seed.")
        return

    logger.info("Seeding demo data into database...")

    # 1. Seed Rates
    for r in DEMO_RATES:
        rate = ScrapRate(**r, currency="INR", is_active=True)
        db.add(rate)
    db.flush()

    # 2. Seed Users
    created_users = []
    for u in DEMO_USERS:
        user = User(
            id=u["id"],
            name=u["name"],
            role=u["role"],
            phone=u.get("phone"),
            latitude=u["latitude"],
            longitude=u["longitude"],
        )
        db.add(user)
        created_users.append(user)
    db.flush()

    # 3. Seed Sample Initial Requests
    sample_requests = [
        {
            "household_id": 1,
            "scrap_type": "newspaper",
            "quantity_kg": 12.5,
            "rate_per_kg": 15.00,
            "estimated_value": 187.50,
            "latitude": 28.6139,
            "longitude": 77.2090,
            "address_note": "B-42, Pandara Road, Ground Floor",
            "status": "OPEN",
        },
        {
            "household_id": 2,
            "scrap_type": "iron",
            "quantity_kg": 25.0,
            "rate_per_kg": 25.00,
            "estimated_value": 625.00,
            "latitude": 28.6200,
            "longitude": 77.2150,
            "address_note": "Sector 3, Building 14",
            "status": "OPEN",
        },
    ]

    for req_data in sample_requests:
        req = ScrapRequest(**req_data)
        db.add(req)
        db.flush()

        # Add initial CREATED event
        event = RequestEvent(
            request_id=req.id,
            actor_id=req.household_id,
            event="CREATED",
            from_status=None,
            to_status="OPEN",
        )
        db.add(event)

    db.commit()
    logger.info("Demo data seeded successfully (5 rates, 5 users, 2 requests).")


def ensure_seed(db: Session) -> None:
    if settings.seed_demo_data:
        seed_database(db)
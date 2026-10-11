from sqlalchemy.orm import Session
from sqlalchemy import func
import random

from app.models import User, ScrapRate, ScrapRequest
from app.config import settings


DEMO_RATES = [
    {"scrap_type": "newspaper", "display_name": "Newspaper", "rate_per_kg": 15.00},
    {"scrap_type": "cardboard", "display_name": "Cardboard", "rate_per_kg": 8.00},
    {"scrap_type": "plastic", "display_name": "Plastic", "rate_per_kg": 10.00},
    {"scrap_type": "iron", "display_name": "Iron", "rate_per_kg": 25.00},
    {"scrap_type": "aluminium", "display_name": "Aluminium", "rate_per_kg": 80.00},
]

BASE_LAT, BASE_LNG = 28.6139, 77.2090
RADIUS_DEG = 0.018


def seed_database(db: Session) -> None:
    if db.query(User).first():
        return

    print("Seeding demo data...")

    rates = []
    for r in DEMO_RATES:
        rate = ScrapRate(**r, currency="INR", is_active=True)
        db.add(rate)
        rates.append(rate)
    db.flush()

    users_data = [
        {"name": "Household A", "role": "HOUSEHOLD"},
        {"name": "Household B", "role": "HOUSEHOLD"},
        {"name": "Vendor 1", "role": "VENDOR"},
        {"name": "Vendor 2", "role": "VENDOR"},
        {"name": "Vendor 3", "role": "VENDOR"},
    ]

    users = []
    for u in users_data:
        lat = BASE_LAT + random.uniform(-RADIUS_DEG, RADIUS_DEG)
        lng = BASE_LNG + random.uniform(-RADIUS_DEG, RADIUS_DEG)
        user = User(**u, latitude=lat, longitude=lng)
        db.add(user)
        users.append(user)
    db.flush()

    households = [u for u in users if u.role == "HOUSEHOLD"]
    vendors = [u for u in users if u.role == "VENDOR"]

    scrap_types = [r["scrap_type"] for r in DEMO_RATES]
    rate_map = {r["scrap_type"]: r["rate_per_kg"] for r in DEMO_RATES}

    for i, household in enumerate(households):
        scrap_type = scrap_types[i % len(scrap_types)]
        rate = rate_map[scrap_type]
        quantity = round(random.uniform(2.0, 10.0), 1)
        lat = household.latitude or BASE_LAT
        lng = household.longitude or BASE_LNG

        request = ScrapRequest(
            household_id=household.id,
            scrap_type=scrap_type,
            quantity_kg=quantity,
            rate_per_kg=rate,
            estimated_value=round(quantity * rate, 2),
            latitude=lat,
            longitude=lng,
            address_note=f"Near {household.name}",
            status="OPEN",
        )
        db.add(request)

    db.commit()
    print("Demo data seeded successfully")


def ensure_seed(db: Session) -> None:
    if settings.seed_demo_data:
        seed_database(db)
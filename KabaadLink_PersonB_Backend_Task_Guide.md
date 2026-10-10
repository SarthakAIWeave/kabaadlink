# KabaadLink — Person B (Backend, Database & AWS Cloud Lead) Task Guide

**Project:** KabaadLink — Hyperlocal Scrap Pickup Marketplace  
**Your Role:** Person B (Backend Engineer, Database Architect, AWS Infrastructure Lead)  
**Teammate Role:** Person A (Frontend Engineer, UI/UX Lead, Amplify Hosting Lead)  
**Time Constraint:** < 6 Hours (Hackathon Execution)  
**Your Stack:** Python 3.12, FastAPI, PostgreSQL, SQLAlchemy 2.x, Docker, AWS (ECS Express Mode, ECR, RDS)  

---

## 1. Whole Project Context & Architecture Overview

### 1.1 Project Purpose & Solution
KabaadLink connects households with nearby scrap vendors (*kabadiwalas*) to eliminate price opacity and wasteful collection travel:
- **Households:** Post scrap pickup requests with estimated weight, material category, location, and address notes. They get transparent indicative rate calculations.
- **Vendors:** View open requests near their location, sorted nearest-first, and claim pickups atomically.
- **Core Hackathon Objective:** Deliver **one fully functional, deployed end-to-end transaction** backed by live PostgreSQL persistence and deployed on AWS:
  $$\text{Household Create Request} \longrightarrow \text{Vendor Nearby Feed} \longrightarrow \text{Atomic Claim (409 on race)} \longrightarrow \text{Picked Up} \longrightarrow \text{Completed}$$

### 1.2 System Architecture Diagram

```text
  📱 Phone / Laptop (Household / Vendor)
                 │  HTTPS
                 ▼
  ┌───────────────────────────────┐
  │ AWS Amplify Hosting           │  Next.js 15 (Person A Owned)
  │ (Frontend UI)                 │  Env: NEXT_PUBLIC_API_BASE_URL
  └───────────────┬───────────────┘
                  │  HTTPS API Calls (Header: X-Demo-User-Id)
                  ▼
  ┌───────────────────────────────┐
  │ AWS ECS Express Mode Service  │  FastAPI (YOUR RESPONSIBILITY)
  │ (Backend API Container)       │  Container Port: 8000 | Health: /health
  └───────────────┬───────────────┘
                  │  PostgreSQL Protocol (Private, Port 5432)
                  ▼
  ┌───────────────────────────────┐
  │ Amazon RDS PostgreSQL         │  Database: kabaadlink (YOUR RESPONSIBILITY)
  │ (Database Layer)              │  Tables: users, scrap_rates, scrap_requests
  └───────────────┴───────────────┘
```

---

## 2. Shared Interface & Contract Protocol

### 2.1 Demo Identity Header
Authentication uses a simple demo header: `X-Demo-User-Id: <integer>`.
Your FastAPI dependencies MUST inspect this header, retrieve the user from the `users` table, and enforce their role (`HOUSEHOLD` or `VENDOR`). If missing or invalid, return `HTTP 401 MISSING_IDENTITY`.

### 2.2 Status Lifecycle & State Transitions

```text
                 ┌── release (assigned vendor) ──┐
                 ▼                               │
 OPEN ── claim (vendor) ──▶ CLAIMED ── pickup (assigned vendor) ──▶ PICKED_UP ── complete (assigned vendor, final weight) ──▶ COMPLETED
  │                           │
  └── cancel (owner) ─────────┴── cancel (owner) ──▶ CANCELLED
```

| Action | Actor | Source Status | Target Status | Key Database Effects |
|---|---|---|---|---|
| `POST /api/requests` | `HOUSEHOLD` | — | `OPEN` | Copy `rate_per_kg` snapshot, compute `estimated_value` |
| `POST /api/requests/{id}/claim` | `VENDOR` | `OPEN` | `CLAIMED` | Atomically set `vendor_id = actor`, `claimed_at = now()` |
| `POST /api/requests/{id}/release` | `VENDOR` | `CLAIMED` (assigned) | `OPEN` | Clear `vendor_id`, clear `claimed_at` |
| `POST /api/requests/{id}/cancel` | `HOUSEHOLD` | `OPEN` or `CLAIMED` (owner) | `CANCELLED` | Set `cancelled_at = now()` |
| `POST /api/requests/{id}/pickup` | `VENDOR` | `CLAIMED` (assigned) | `PICKED_UP` | Set `picked_up_at = now()` |
| `POST /api/requests/{id}/complete` | `VENDOR` | `PICKED_UP` (assigned) | `COMPLETED` | Require `final_weight_kg`, compute `final_amount = final_weight_kg * rate_per_kg` |

---

## 3. Your Specific Tasks & Deliverables (Person B)

You own the **entire `backend/` directory, database schema, FastAPI logic, AWS RDS/ECR/ECS deployment, and automated double-claim race testing**.

### Directory Structure to Build:
```text
backend/
  app/
    main.py                 # FastAPI app, CORS middleware, DB startup retries, routers
    config.py               # Settings (DATABASE_URL, CORS_ORIGINS, DEFAULT_RADIUS_KM, SEED_DEMO_DATA)
    db.py                   # SQLAlchemy engine, SessionLocal, get_db dependency
    models.py               # SQLAlchemy ORM models (User, ScrapRate, ScrapRequest)
    schemas.py              # Pydantic v2 schemas (Summary, Detail, Requests)
    deps.py                 # Header dependency (get_actor, require_role)
    geo.py                  # Haversine distance, bounding box calculations, rounding
    seed.py                 # Startup idempotent database seeder
    routers/
      health.py             # /health, /ping, /health/db endpoints
      demo.py               # /api/demo/users endpoint
      rates.py              # /api/rates endpoint
      requests.py           # /api/requests/* endpoints
  tests/
    test_claim_race.py      # Concurrent double-claim race testing script
  Dockerfile                # Container specification (linux/amd64)
  requirements.txt          # fastapi, uvicorn, sqlalchemy, psycopg[binary], pydantic, httpx
  docker-compose.yml        # Local PostgreSQL development setup
```

---

### 3.1 Database Schema & Data Models

Implement the following schema using SQLAlchemy 2.x and PostgreSQL:

#### Table `users`
- `id` (bigserial PK)
- `name` (text, NOT NULL)
- `role` (text, NOT NULL CHECK in `'HOUSEHOLD'`, `'VENDOR'`)
- `latitude`, `longitude` (double precision, NULLABLE)
- `created_at` (timestamptz, default `now()`)

#### Table `scrap_rates`
- `id` (bigserial PK)
- `scrap_type` (text, NOT NULL, e.g. `'newspaper'`, `'cardboard'`, `'plastic'`, `'iron'`, `'aluminium'`)
- `display_name` (text, NOT NULL)
- `rate_per_kg` (numeric(10,2), NOT NULL CHECK > 0)
- `currency` (char(3), NOT NULL default `'INR'`)
- `effective_from` (timestamptz, default `now()`)
- `is_active` (boolean, default `true`)

#### Table `scrap_requests`
- `id` (bigserial PK)
- `household_id` (bigint FK `users.id`, NOT NULL)
- `vendor_id` (bigint FK `users.id`, NULLABLE)
- `scrap_type` (text, NOT NULL)
- `quantity_kg` (numeric(8,3), NOT NULL CHECK between 0.1 and 500)
- `rate_per_kg` (numeric(10,2), NOT NULL) — *Snapshot copy from scrap_rates*
- `estimated_value` (numeric(12,2), NOT NULL) — *Calculated: quantity_kg * rate_per_kg*
- `latitude`, `longitude` (double precision, NOT NULL, CHECK lat in [-90,90], lng in [-180,180])
- `address_note` (text, NULLABLE, max 200 chars)
- `status` (text, NOT NULL CHECK in `'OPEN'`, `'CLAIMED'`, `'PICKED_UP'`, `'COMPLETED'`, `'CANCELLED'`)
- `final_weight_kg` (numeric(8,3), NULLABLE)
- `final_amount` (numeric(12,2), NULLABLE)
- `created_at`, `updated_at` (timestamptz, NOT NULL)
- `claimed_at`, `picked_up_at`, `completed_at`, `cancelled_at` (timestamptz, NULLABLE)

#### Invariant Constraints & Indexes:
- `status == 'OPEN'` $\implies$ `vendor_id IS NULL`
- `status IN ('CLAIMED', 'PICKED_UP', 'COMPLETED')` $\implies$ `vendor_id IS NOT NULL`
- `status == 'COMPLETED'` $\implies$ `final_weight_kg IS NOT NULL AND final_amount IS NOT NULL`
- Indexes: `(status, created_at)`, `(household_id)`, `(vendor_id)`.

#### Idempotent Seed Data (App Startup):
Seed when `users` table is empty:
- **Rates (INR/kg):** Newspaper: 15.00, Cardboard: 8.00, Plastic: 10.00, Iron: 25.00, Aluminium: 80.00.
- **Users:** 2 Households (Household A, Household B) and 3 Vendors (Vendor 1, Vendor 2, Vendor 3).
- **Coordinates:** Cluster seed users within ~2 km of (Lat: `28.6139`, Lng: `77.2090`).

---

### 3.2 FastAPI Implementation & Atomic Claim Logic

#### 1. Route Ordering Rule:
Declare explicit routes **before** path parameter routes to prevent FastAPI router shadowing:
- `GET /api/requests/nearby` and `GET /api/requests/mine` MUST be declared BEFORE `GET /api/requests/{id}`.

#### 2. Atomic Claim Logic (Single SQL Statement):
Do NOT perform read-then-write in Python. Enforce atomic claim directly at the database level:

```python
from sqlalchemy import update, func

def claim_request(db: Session, request_id: int, vendor_id: int) -> bool:
    result = db.execute(
        update(ScrapRequest)
        .where(
            ScrapRequest.id == request_id,
            ScrapRequest.status == "OPEN"
        )
        .values(
            status="CLAIMED",
            vendor_id=vendor_id,
            claimed_at=func.now(),
            updated_at=func.now()
        )
    )
    db.commit()
    return result.rowcount == 1
```
*If `result.rowcount == 0`*:
- If request does not exist $\rightarrow$ Return `404 NOT_FOUND`
- If request exists but `status != 'OPEN'` $\rightarrow$ Return `409 ALREADY_CLAIMED` (`{"error": {"code": "ALREADY_CLAIMED", "message": "This request was just claimed by another vendor."}}`)

#### 3. Distance Calculation & Bounding Box Filter (`GET /api/requests/nearby`):
- Compute bounding box:
  $$\Delta \text{lat} = \frac{\text{radius}}{111.0}, \quad \Delta \text{lng} = \frac{\text{radius}}{111.0 \times \cos(\text{radians}(\text{lat}))}$$
- Compute exact distance in Python using Haversine formula (Earth radius = `6371.0088` km):
```python
from math import radians, sin, cos, asin, sqrt

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0088
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))
```
- Sort results nearest-first. Round `distance_km` to `0.1` km in the summary response.

#### 4. Privacy Shaping:
- `GET /api/requests/nearby` (Summary): Returns approximate coordinates (rounded to 2 decimal places, ~1.1 km precision) and rounded distance. Excludes household name and exact address note.
- `GET /api/requests/{id}` (Detail): Exposes exact coordinates, `address_note`, household name, assigned vendor name, and timestamp history ONLY to the owner household or assigned vendor.

#### 5. CORS Middleware Setup:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list, # e.g. ["http://localhost:3000"]
    allow_origin_regex=r"https://.*\.amplifyapp\.com", # Prevents chicken-and-egg deployment deadlock
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Demo-User-Id"], # X-Demo-User-Id MUST be allowed
)
```

---

### 3.3 AWS Cloud Infrastructure & Deployment Runbook

#### Step 1: Provision RDS PostgreSQL (T+0 to T+20 min)
1. Engine: Amazon RDS for PostgreSQL (Small burstable, Single-AZ, DB Name: `kabaadlink`).
2. Public Access: `No`, Default VPC.
3. Password: Alphanumeric only (avoid special characters that break URL parsing).
4. Security Group: Allow inbound TCP `5432` from ECS task security group / VPC CIDR.

#### Step 2: Build & Push Docker Image to ECR
**CRITICAL:** Build specifically for `linux/amd64` platform (prevents `exec format error` on Fargate):
```bash
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

docker buildx build --platform linux/amd64 -t <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/kabaadlink-api:<GIT_SHA> --push backend/
```

#### Step 3: Configure ECS Express Mode Service
- **CRITICAL OVERRIDES:**
  - **Container Port:** Override default `80` $\rightarrow$ set to **`8000`**.
  - **Health Check Path:** Override default `/ping` $\rightarrow$ set to **`/health`** (or add `/ping` alias in FastAPI).
- Environment Variables: `DATABASE_URL`, `CORS_ORIGINS`, `SEED_DEMO_DATA=true`.
- Validate liveness: `https://<ECS_URL>/health`.

---

### 3.4 Double-Claim Race Testing Script (`tests/test_claim_race.py`)

```python
import sys, concurrent.futures, httpx

base_url = sys.argv[1].rstrip("/")
request_id = int(sys.argv[2])
vendor_ids = [int(v) for v in sys.argv[3:]]

def attempt_claim(vid):
    r = httpx.post(f"{base_url}/api/requests/{request_id}/claim", headers={"X-Demo-User-Id": str(vid)}, timeout=15.0)
    return vid, r.status_code, r.json()

with concurrent.futures.ThreadPoolExecutor(max_workers=len(vendor_ids)) as executor:
    results = list(executor.map(attempt_claim, vendor_ids))

successes = [v for v, code, _ in results if code == 200]
conflicts = [v for v, code, _ in results if code == 409]

print(f"Results: 200 Success: {successes}, 409 Conflicts: {conflicts}")
assert len(successes) == 1, f"Expected 1 winner, got {len(successes)}"
assert len(conflicts) == len(vendor_ids) - 1, "Expected all others to fail with 409"
print("✅ PASS: Atomic claim race test succeeded!")
```

---

## 4. Synchronized 6-Hour Timeline & Milestones

| Phase & Time | Person B (Your Tasks) | Person A (Teammate Tasks) | Joint Sync Gate |
|---|---|---|---|
| **Phase 0 (T+0 $\rightarrow$ T+25m)** | Start RDS creation immediately. Create ECR repo & AWS budget alert. | Setup Next.js 15 repo structure, mock JSON files. | **Gate G0:** Freeze API contract in `contract/examples/*.json`. |
| **Phase 1 (T+25m $\rightarrow$ T+100m)** | Develop FastAPI endpoints locally, Dockerize (`--platform linux/amd64`), deploy ECS Express Mode service. | Build Next.js UI pages against mock mode (`NEXT_PUBLIC_USE_MOCK=true`). Deploy Amplify skeleton. | **Gate G1 (Walking Skeleton):** Deployed UI calls deployed API `/health` & `/api/demo/users` over HTTPS. |
| **Phase 2 (T+100m $\rightarrow$ T+190m)** | Implement atomic `claim` in SQL, nearby Haversine search, run `test_claim_race.py`. | Switch frontend to real API URL. Wire Claim button with 409 Conflict error handling. | **Gate G2:** Full end-to-end loop (Create $\rightarrow$ Feed $\rightarrow$ Claim $\rightarrow$ Complete) working live on AWS. |
| **Phase 3 (T+190m $\rightarrow$ T+270m)** | Database persistence test across redeploys, CORS verification, CloudWatch log review. | Mobile UI polish, empty states, IST timestamps, finalize pitch script & demo dataset. | **Gate G3 (Feature Freeze):** All P0 items passing. Zero new code changes. |
| **Phase 4 (T+270m $\rightarrow$ T+330m)** | Assist in demo dry-run & backup video recording. | Rehearse 90s pitch twice. Record backup demo video. Submit on hackathon portal. | Final submission saved & verified. |

---

## 5. Person B Checklist

- [ ] `GET /health` returns `HTTP 200` from deployed ECS service over HTTPS.
- [ ] Database automatically seeds demo users and indicative rates on initial startup.
- [ ] Explicit routes (`/nearby`, `/mine`) are defined before wildcard routes (`/{id}`).
- [ ] Atomic claim uses single conditional SQL `UPDATE` statement.
- [ ] Second claim attempt on a claimed request returns `HTTP 409 ALREADY_CLAIMED`.
- [ ] Race test script passes with 1 winner and N-1 409 Conflict responses.
- [ ] Nearby feed filters by Haversine distance and hides exact location data.
- [ ] Docker image built with `--platform linux/amd64`.
- [ ] ECS Express Mode overrides container port `8000` and health check `/health`.
- [ ] Data persists in PostgreSQL across API restarts and redeployments.

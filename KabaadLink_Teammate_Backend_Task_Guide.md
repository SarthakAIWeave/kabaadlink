# KabaadLink — Teammate Task Guide & Architecture Specification (Person B Focus)

**Project:** KabaadLink — Hyperlocal Scrap Pickup Marketplace  
**Target Teammate:** Person B (Backend, Database, Cloud Infrastructure & AWS Deployment Engineer)  
**Partner Role:** Person A (Frontend, UI/UX, Next.js 15, Amplify Deployment)  
**Time Constraint:** < 6 Hours (Hackathon Execution)  
**Stack:** Next.js 15 (Frontend) | Python FastAPI (Backend) | PostgreSQL (Database) | AWS (Amplify, ECS Express Mode, ECR, RDS)  

---

## 1. Whole Project Context & Architecture Overview

### 1.1 Project Purpose & Solution
KabaadLink connects households with local scrap vendors (*kabadiwalas*) to eliminate price opacity and wasteful travel:
- **Households:** Post scrap pickup requests with estimated weight, category, location, and optional notes. They get transparent indicative rate calculations.
- **Vendors:** View open requests near their current or specified location, sorted nearest-first, and claim pickups atomically.
- **Core Hackathon Objective:** Deliver **one fully functional, deployed end-to-end transaction** backed by live PostgreSQL persistence and deployed on AWS:
  $$\text{Household Create Request} \longrightarrow \text{Vendor Nearby Feed} \longrightarrow \text{Atomic Claim (409 on race)} \longrightarrow \text{Picked Up} \longrightarrow \text{Completed}$$

### 1.2 Logical Architecture

```text
  📱 Phone / Laptop (Household / Vendor)
                 │  HTTPS
                 ▼
  ┌───────────────────────────────┐
  │ AWS Amplify Hosting           │  Next.js 15 (App Router, Client-side Fetching)
  │ (Person A Owned)              │  Env: NEXT_PUBLIC_API_BASE_URL
  └───────────────┬───────────────┘
                  │  HTTPS API Calls (Header: X-Demo-User-Id)
                  ▼
  ┌───────────────────────────────┐
  │ AWS ECS Express Mode Service  │  FastAPI (Docker Container on Port 8000)
  │ (Person B Owned)              │  Endpoints: /health, /ping, /api/*
  └───────────────┬───────────────┘
                  │  PostgreSQL Protocol (Private, Port 5432)
                  ▼
  ┌───────────────────────────────┐
  │ Amazon RDS for PostgreSQL     │  Database: kabaadlink (Private Subnet / Default VPC)
  │ (Person B Owned)              │  Stores: users, scrap_rates, scrap_requests
  └───────────────────────────────┘
```

---

## 2. Shared Interface & Contract Protocol

### 2.1 Demo Identity & Role Authentication
- Authentication uses a lightweight header for hackathon simplicity: `X-Demo-User-Id: <integer>`.
- The backend loads the user from `users` table and enforces the stored role (`HOUSEHOLD` vs `VENDOR`).
- If the header is missing or user non-existent, return `HTTP 401 MISSING_IDENTITY`.

### 2.2 Status Lifecycle & Transition Rules

```text
                 ┌── release (assigned vendor) ──┐
                 ▼                               │
 OPEN ── claim (vendor) ──▶ CLAIMED ── pickup (assigned vendor) ──▶ PICKED_UP ── complete (assigned vendor, final weight) ──▶ COMPLETED
  │                           │
  └── cancel (owner) ─────────┴── cancel (owner) ──▶ CANCELLED
```

| Action | Actor | Allowed Source Status | Target Status | Key Database Effects |
|---|---|---|---|---|
| `POST /api/requests` | `HOUSEHOLD` | — | `OPEN` | Snapshots `rate_per_kg`, calculates `estimated_value = quantity_kg * rate` |
| `POST /api/requests/{id}/claim` | `VENDOR` | `OPEN` | `CLAIMED` | Atomically sets `vendor_id = actor`, `claimed_at = now()` |
| `POST /api/requests/{id}/release` | `VENDOR` | `CLAIMED` (assigned) | `OPEN` | Clears `vendor_id`, clears `claimed_at` |
| `POST /api/requests/{id}/cancel` | `HOUSEHOLD` | `OPEN` or `CLAIMED` (owner) | `CANCELLED` | Sets `cancelled_at = now()` |
| `POST /api/requests/{id}/pickup` | `VENDOR` | `CLAIMED` (assigned) | `PICKED_UP` | Sets `picked_up_at = now()` |
| `POST /api/requests/{id}/complete` | `VENDOR` | `PICKED_UP` (assigned) | `COMPLETED` | Requires `final_weight_kg`, computes `final_amount = final_weight_kg * rate_per_kg`, sets `completed_at` |

---

## 3. Teammate Specific Tasks (Person B Deliverables)

As **Person B**, you own the **entire backend, database, and AWS cloud backend infrastructure**:

### Ownership Scope:
1. `backend/` folder (FastAPI codebase, Dockerfile, requirements, docker-compose).
2. Database layer (PostgreSQL models, constraints, initial seed data).
3. AWS Cloud Resources: RDS PostgreSQL, ECR repository, ECS Express Mode service, IAM roles, AWS Budgets alert.
4. Testing & Reliability: Double-claim race testing script (`tests/test_claim_race.py`).

---

### 3.1 Database Schema & Data Models

Implement the following schema in SQLAlchemy 2.x / PostgreSQL:

#### Table `users`
- `id` (bigserial PK)
- `name` (text, NOT NULL)
- `role` (text, NOT NULL, CHECK in `'HOUSEHOLD'`, `'VENDOR'`)
- `latitude`, `longitude` (double precision, NULLABLE — used only for demo default fallback)
- `created_at` (timestamptz, default `now()`)

#### Table `scrap_rates`
- `id` (bigserial PK)
- `scrap_type` (text, NOT NULL, e.g., `'newspaper'`, `'cardboard'`, `'plastic'`, `'iron'`, `'aluminium'`)
- `display_name` (text, NOT NULL)
- `rate_per_kg` (numeric(10,2), NOT NULL CHECK > 0) — *Indicative Rate*
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

#### Mandatory DB Constraints & Indexes:
- Invariants:
  - `status == 'OPEN'` $\implies$ `vendor_id IS NULL`
  - `status IN ('CLAIMED', 'PICKED_UP', 'COMPLETED')` $\implies$ `vendor_id IS NOT NULL`
  - `status == 'COMPLETED'` $\implies$ `final_weight_kg IS NOT NULL AND final_amount IS NOT NULL`
- Indexes: `(status, created_at)`, `(household_id)`, `(vendor_id)`.

#### Idempotent Seed Data (Required at App Startup):
Seed when `users` table is empty:
- **Rates (INR/kg):** Newspaper: 15.00, Cardboard: 8.00, Plastic: 10.00, Iron: 25.00, Aluminium: 80.00.
- **Users:** 2 Households (e.g. Household A, Household B) and 3 Vendors (Vendor 1, Vendor 2, Vendor 3).
- **Coordinates:** Cluster all seed users within ~2 km of (Lat: `28.6139`, Lng: `77.2090`) so they appear in the default 5 km nearby feed radius.

---

### 3.2 FastAPI Implementation & Atomic Claim Logic

#### 1. Crucial Route Order Rule:
Declare explicit routes **before** path parameter routes to prevent FastAPI router shadowing:
- `GET /api/requests/nearby` and `GET /api/requests/mine` MUST be declared BEFORE `GET /api/requests/{id}`.

#### 2. Atomic Claim Mechanism (Single SQL Statement):
Do NOT do read-then-write in Python. Enforce atomic claim directly at the database level:

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
    # Returns True if claimed successfully, False if already claimed or not found
    return result.rowcount == 1
```
*If `result.rowcount == 0`*, query the DB to check if the request exists:
- If missing $\rightarrow$ Return `404 NOT_FOUND`
- If exists but `status != 'OPEN'` $\rightarrow$ Return `409 ALREADY_CLAIMED` (`{"error": {"code": "ALREADY_CLAIMED", "message": "This request was just claimed by another vendor."}}`)

#### 3. Distance Calculation & Bounding Box Filter (`GET /api/requests/nearby`):
- Caller passes `lat`, `lng`, optional `radius_km` (default 5, max 25).
- SQL Bounding Box pre-filter:
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

#### 4. Privacy & Response Shaping:
- **`GET /api/requests/nearby` (Summary - Any Vendor):** Returns only approximate coordinates (rounded to 2 decimal places, ~1.1 km precision) and rounded distance. Does NOT expose household name or exact address notes.
- **`GET /api/requests/{id}` (Detail - Owner Household or Assigned Vendor only):** Exposes exact latitude, longitude, `address_note`, household name, assigned vendor name, and timestamp history. If requested by an unassigned vendor when non-`OPEN`, return `404 NOT_FOUND`.

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
1. Engine: Amazon RDS for PostgreSQL (Small burstable instance, Single-AZ).
2. DB Name: `kabaadlink`, Public Access: `No`, Default VPC.
3. Master Username/Password: Alphanumeric only (avoid special characters that break SQLAlchemy URLs).
4. Security Group: Allow inbound TCP `5432` from the ECS task security group or VPC CIDR.

#### Step 2: Docker Containerization
`backend/Dockerfile`:
```dockerfile
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
```

#### Step 3: Build & Push to ECR
**CRITICAL:** Build specifically for `linux/amd64` platform (prevents `exec format error` on AWS Fargate):
```bash
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

docker buildx build --platform linux/amd64 -t <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/kabaadlink-api:<GIT_SHA> --push backend/
```

#### Step 4: Configure ECS Express Mode Service
- AWS App Runner was discontinued for new customers on April 30, 2026. Use **AWS ECS Express Mode** (or ECS Fargate service).
- **CRITICAL OVERRIDES (Default values will fail health check!):**
  - **Container Port:** Override default `80` $\rightarrow$ set to **`8000`**.
  - **Health Check Path:** Override default `/ping` $\rightarrow$ set to **`/health`** (or add `/ping` alias in FastAPI).
- Environment Variables:
  - `DATABASE_URL=postgresql+psycopg://username:password@rds-endpoint:5432/kabaadlink`
  - `CORS_ORIGINS=http://localhost:3000`
  - `SEED_DEMO_DATA=true`
- Validate endpoint liveness: Open `https://<ECS_URL>/health` in browser.

---

### 3.4 Verification & Automated Race Test Script

Create `backend/tests/test_claim_race.py` to verify atomic claim protection under concurrent vendor attempts:

```python
import sys
import concurrent.futures
import httpx

if len(sys.argv) < 4:
    print("Usage: python test_claim_race.py <BASE_URL> <REQUEST_ID> <VENDOR_ID_1> <VENDOR_ID_2> [VENDOR_ID_3]")
    sys.exit(1)

base_url = sys.argv[1].rstrip("/")
request_id = int(sys.argv[2])
vendor_ids = [int(v) for v in sys.argv[3:]]

def attempt_claim(vid):
    r = httpx.post(
        f"{base_url}/api/requests/{request_id}/claim",
        headers={"X-Demo-User-Id": str(vid)},
        timeout=15.0
    )
    return vid, r.status_code, r.json()

print(f"Testing concurrent claim race on request {request_id} with vendors {vendor_ids}...")
with concurrent.futures.ThreadPoolExecutor(max_workers=len(vendor_ids)) as executor:
    results = list(executor.map(attempt_claim, vendor_ids))

print("\n--- Race Results ---")
for vid, code, resp in results:
    print(f"Vendor {vid} -> HTTP {code}: {resp}")

successes = [v for v, code, _ in results if code == 200]
conflicts = [v for v, code, _ in results if code == 409]

print("\n--- Audit Summary ---")
print(f"Successful claims (200): {len(successes)} -> Vendor IDs: {successes}")
print(f"Blocked claims (409): {len(conflicts)} -> Vendor IDs: {conflicts}")

assert len(successes) == 1, f"FAILED: Expected exactly 1 winner, got {len(successes)}"
assert len(conflicts) == len(vendor_ids) - 1, "FAILED: Not all secondary vendors received 409 Conflict"
print("\n✅ PASS: Atomic claim race test succeeded!")
```

---

## 4. Synchronized 6-Hour Timeline & Milestones

| Phase & Time | Person B (Backend / Cloud Owner) | Person A (Frontend Owner) | Joint Sync Gate |
|---|---|---|---|
| **Phase 0 (T+0 $\rightarrow$ T+25m)** | Start RDS creation immediately. Create ECR repo & AWS budget alert. Verify account/region permissions. | Init repo structure (`frontend/`, `backend/`, `contract/`). Set up Next.js 15 app. | **Gate G0:** Freeze API contract examples in `contract/examples/*.json`. Confirm RDS provisioning. |
| **Phase 1 (T+25m $\rightarrow$ T+100m)** | Develop FastAPI models, endpoints (`rates`, `demo/users`, `create`, `nearby`, `mine`), Compose Postgres locally. Build & push Docker image to ECR. Deploy ECS Express Mode service. | Build Next.js screens against mock mode (`NEXT_PUBLIC_USE_MOCK=true`). Connect Amplify to repo and deploy skeleton. | **Gate G1 (Walking Skeleton):** Deployed frontend successfully calls deployed API (`/health` and `/api/demo/users` return 200 over HTTPS with CORS). |
| **Phase 2 (T+100m $\rightarrow$ T+190m)** | Implement atomic `claim`, `pickup`, `complete`. Add privacy shaping. Connect ECS service to cloud RDS. Run `test_claim_race.py`. | Switch frontend to real API URL. Wire Claim button to handle 409 Conflict error. Build Pickup/Complete screens. | **Gate G2:** Full end-to-end loop (Create $\rightarrow$ Feed $\rightarrow$ Claim $\rightarrow$ Pickup $\rightarrow$ Complete) works live on deployed AWS stack. |
| **Phase 3 (T+190m $\rightarrow$ T+270m)** | Verify DB persistence across container redeploys. Tighten CORS headers. Final log inspection. | Mobile UI polish, empty/loading states, IST time formatting, demo pitch script. | **Gate G3 (Feature Freeze):** Complete testing checklist (§5). Zero new feature additions. |
| **Phase 4 (T+270m $\rightarrow$ T+330m)** | Assist in demo walkthrough dry-run. Record backup video. | Rehearse demo pitch twice. Verify live URL from external mobile network. Submit project on hackathon portal. | Final submission saved & confirmed. |

---

## 5. Teammate Acceptance & Verification Checklist

Before declaring backend completion, verify every item below on the **deployed AWS stack**:

- [ ] `GET https://<API_URL>/health` returns `HTTP 200` with `{"status": "healthy"}`.
- [ ] `GET https://<API_URL>/api/demo/users` returns seeded households and vendors.
- [ ] `GET https://<API_URL>/api/rates` returns indicative scrap rate card.
- [ ] Household can create a request (`POST /api/requests`) with `X-Demo-User-Id`.
- [ ] Invalid quantities (`quantity_kg <= 0` or `> 500`) return `HTTP 422`.
- [ ] Open requests appear in `GET /api/requests/nearby?lat=...&lng=...` with calculated `distance_km`.
- [ ] Vendor claim (`POST /api/requests/{id}/claim`) succeeds once (`HTTP 200`).
- [ ] Second vendor claim attempt on the same request returns `HTTP 409 ALREADY_CLAIMED`.
- [ ] Claim race test script (`python test_claim_race.py ...`) passes with exactly 1 winner.
- [ ] Vendor can advance status: `pickup` (`CLAIMED` $\rightarrow$ `PICKED_UP`) then `complete` with `final_weight_kg`.
- [ ] Final status and calculations persist in PostgreSQL after refreshing the browser or redeploying the container.
- [ ] CORS allows cross-origin requests from the AWS Amplify frontend domain.

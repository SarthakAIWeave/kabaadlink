# KabaadLink — Refined Architecture & Two-Person Execution Plan (v2)

**Project:** KabaadLink — hyperlocal scrap-pickup marketplace (households ↔ kabadiwalas)
**Team:** 2 people · **Time:** under 6 hours · **Required stack:** Next.js + Python + SQL, deployed on AWS
**Document status:** Replaces `KabaadLink_Hackathon_Context_and_Architecture.md` (v1). All v1 intent is preserved; defects found in v1 are fixed and listed in §1.2.

---

## 0. How to read this document

Every non-obvious claim carries a confidence tag so you know what to trust and what to verify:

| Tag | Meaning |
|---|---|
| **[V]** | Verified during this review against AWS documentation or other sources found by search. |
| **[K]** | General engineering knowledge. Believed correct, **not** verified against your specific account or setup. Test it. |
| **[J]** | My design judgment. A recommendation, not a fact. |
| **[?]** | Unknown. Needs a decision or a check by you. |

**Code in this document is reference sketches. None of it was executed.** Treat it as a starting point and test it locally before relying on it.

### 0.1 What this plan optimizes for

One reliable end-to-end transaction (create → see → claim → pickup → complete), deployed on AWS, demonstrable from two devices, with provably correct double-claim protection. Everything else is secondary and has an explicit cut line (§3.3).

---

## 1. Review summary

### 1.1 Facts that changed the plan

1. **AWS App Runner is closed to new customers since April 30, 2026. [V]** Existing customers can keep using it. AWS recommends Amazon ECS Express Mode as the replacement. v1 chose App Runner for the backend, so v1's backend hosting may be unusable on your account.
2. **ECS Express Mode [V]:** You provide a container image plus a task execution role and an infrastructure role. It provisions a Fargate service behind a load balancer with HTTPS and an auto-generated URL. Its documented defaults are container port **80**, health-check path **`/ping`**, and the **default VPC** when none is specified. A FastAPI container on port 8000 with `/health` will therefore fail health checks unless you override those settings (§12). Express Mode itself has no extra charge; the underlying resources (Fargate, load balancer) are billed normally [K].
3. **Amplify Hosting supports Next.js 12 through 15, with Node.js 20 and 22 runtimes [V].** One third-party write-up reports Next.js 16 deploying on Amplify, but AWS's own documentation that I found lists up to 15. **Pin Next.js 15.x.**
4. **AWS Free Tier changed for accounts created on or after July 15, 2025 [V]:** a Free plan or Paid plan, with $100 in credits plus up to $100 more for onboarding activities. The Free plan restricts some services, and upgrading to Paid keeps the credits. Whether ECS/Fargate, load balancers and RDS are available on a Free-plan account was **not** verified [?]. Check it at T+0.
5. **Possible hackathon rules [?]:** A "First Commit" hackathon (Sept 17–20, 2026), part of the Bharat Builds Tour with AWS Builder Center, required a live AWS deployment URL, scored the architecture, required using AWS services to win a prize, and asked for the project to be published on Builder Center. That event is already over, and I cannot tell whether your event is a later stop of the tour. **Read your own event's rules; do not assume these apply.**

### 1.2 Defects found in v1 and how v2 fixes them

| # | v1 problem | v2 fix |
|---|---|---|
| D1 | Backend hosted on App Runner (closed to new customers) | ECS Express Mode as Plan A, with fallbacks (§4.3) |
| D2 | "Deploy early" in Next Actions, but schedule deployed at minute 180 | Walking-skeleton deploy gate at T+100 (§17) |
| D3 | API had no actor identity, yet required role checks | Demo identity header `X-Demo-User-Id`, validated server-side (§8.1) |
| D4 | Privacy rule "hide exact location" had no data/API support | Feed returns only approximate coordinates and rounded distance; exact data only to owner and assigned vendor (§8.4, §9) |
| D5 | Vendor location had two sources (`users.lat/lng` and query params) | Query params are authoritative; stored user location is only a demo default (§9) |
| D6 | Create-request response contained `distance_km`, meaningless for a household | Removed from create response |
| D7 | `PATCH /status` was ambiguous: could bypass `/claim`, had no payload for final weight, no actor rules | Replaced with explicit action endpoints (`claim`, `release`, `cancel`, `pickup`, `complete`) (§8) |
| D8 | Nullable request coordinates contradicted "handle missing coordinates" | Request coordinates are required; the missing-coordinate case cannot exist on the request side |
| D9 | No "my requests" / "my pickups" endpoint, so household status and vendor pickup screens had no data source | `GET /api/requests/mine`, role-aware |
| D10 | Stuck claim possible (vendor claims and never shows) | `release` (vendor) and `cancel` (household) transitions |
| D11 | Money/float handling unspecified | `NUMERIC` in the database, `Decimal` for calculation, JSON numbers at the API boundary (§6.4) |
| D12 | CORS pitfalls unaddressed (custom header forces a preflight; the Amplify URL is unknown before first deploy) | Explicit CORS rules and deploy ordering (§12.4) |
| D13 | RDS networking hand-waved ("avoid VPC work") | Concrete default-VPC + security-group recipe (§12.3) |
| D14 | Schedule: ~330–360 min against under 360 min available, no gates, no cut lines | Gated schedule with timeboxes and cut lines (§17) |
| D15 | No test for the central claim (double-claim) beyond a manual check | Automated race test (§15.2) |
| D16 | Transactions table and `PATCH` had no consistent completion data path | Final weight/amount stored on the request (AD-009) |

---

## 2. Goals, non-goals, acceptance criteria

### 2.1 Goals
1. Household creates a pickup request; it is saved in PostgreSQL.
2. Vendor sees open requests within a radius, sorted nearest-first.
3. Vendor claims atomically; a second claim fails with 409.
4. Assigned vendor marks picked up, then completed with a final weight.
5. State survives refresh and is visible from a second device.
6. Public AWS deployment reachable over HTTPS from any network.

### 2.2 Non-goals (explicit)
Real authentication, payments/escrow, live GPS tracking, multi-stop route optimization, chat, ratings, notifications, KYC, analytics, multi-region, microservices.

### 2.3 Definition of Done (P0)
All items in §15.3 pass on the **deployed** stack, from a phone on mobile data and a laptop on a different network, with no manual database edits during the demo.

---

## 3. Scope and cut lines

### 3.1 P0 (must work)
- Role/demo-user picker
- `GET /api/rates`
- Create request (server computes the estimate)
- Vendor nearby feed (distance, radius filter, nearest-first)
- Atomic `claim`
- `pickup` and `complete` (with final weight)
- Household "my requests" with live status
- Vendor "my pickups"
- Loading, empty and error states
- Deployed on AWS (frontend + API + PostgreSQL)

### 3.2 P1 (only after the P0 gate G2 passes)
- `cancel` (household) and `release` (vendor)
- Request-detail screen with an event timeline (`request_events`)
- Idempotent create (`client_token`)
- Feed auto-refresh (polling) and "taken by another vendor" UX
- Structured logs with claim outcomes
- README with architecture diagram

### 3.3 Cut lines (drop in this order when time is short)
1. Event timeline / `request_events`
2. Idempotent create token
3. Polling (fall back to a manual refresh button)
4. `release`, then `cancel`
5. Request-detail screen (show details inline instead)
6. Everything except: **create → feed → claim (409 on second) → pickup → complete → persists**

### 3.4 P2 (do not start)
Route optimization, live maps, payments, auth/KYC, chat, reviews, notifications, analytics.

---

## 4. Architecture

### 4.1 Logical architecture

```text
 Phone / laptop browser
        │  HTTPS
        ▼
 ┌───────────────────────────────┐
 │ AWS Amplify Hosting           │  Next.js 15 (App Router, client-side data fetching)
 │ (Next.js SSR compute) [V]     │  NEXT_PUBLIC_API_BASE_URL → API
 └───────────────┬───────────────┘
                 │  HTTPS, JSON, header X-Demo-User-Id (CORS)
                 ▼
 ┌───────────────────────────────┐
 │ ECS Express Mode service [V]  │  Fargate task running the FastAPI container (port 8000)
 │ (HTTPS URL + load balancer)   │  /health, /api/*
 └───────────────┬───────────────┘
                 │  PostgreSQL protocol, private (default VPC, security group)
                 ▼
 ┌───────────────────────────────┐
 │ Amazon RDS for PostgreSQL     │  not publicly accessible [J]
 └───────────────────────────────┘

 Supporting: ECR (container image), CloudWatch Logs (app + Amplify logs), IAM roles, AWS Budgets alert
```

### 4.2 Component responsibilities

| Component | Responsibility | Must NOT do |
|---|---|---|
| Next.js frontend | UI, demo-identity selection, geolocation/preset location, calling the API, displaying server-computed values | Compute authoritative prices, enforce access, hold secrets |
| FastAPI | Validation, authorization (role/ownership), state machine, atomic updates, distance math, privacy shaping | Trust any client-supplied rate, value, status or role beyond the demo header |
| PostgreSQL | Source of truth; constraints as the last line of defense | Be reachable from the internet |

### 4.3 Hosting decision for the API (ordered fallbacks)

| Plan | What | Use when | Confidence |
|---|---|---|---|
| **A (recommended)** | Docker image → ECR → **ECS Express Mode** | Docker available on at least one laptop; ECS/Fargate/load balancer allowed on the account | [V] feature exists and defaults; [?] your account permissions |
| A′ | App Runner (v1 plan) | Only if the console lets your account create a service (you're an existing App Runner customer) | [V] closed to new customers; try it for 2 minutes at T+0 |
| B | FastAPI on Lambda behind a function URL via a web adapter | ECS blocked/too slow; you can use zip or container Lambda | [K] not verified here; DB connection pooling needs care |
| C | Single EC2 (or Lightsail) instance running the container; browser calls go through a **Next.js server-side proxy route** (so plain-HTTP backend is never called from the browser) | Everything managed is blocked | [K]; the proxy avoids mixed-content and CORS but adds a component |

**Timebox:** If Plan A has not produced a working `https://…/health` by **T+110**, start Plan B or C in parallel and stop debugging Plan A after 30 more minutes.

### 4.4 Technology choices

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js **15.x** (pin), React, TypeScript, Tailwind CSS | Node 20 or 22 on Amplify [V]. Page data fetched client-side. |
| Backend | Python 3.12 [J], FastAPI, Pydantic v2, SQLAlchemy 2.x, `psycopg` v3 (binary), Uvicorn | Auto-generated `/docs` helps frontend work. |
| Database | PostgreSQL (RDS, small burstable, single-AZ [J]) | Use Postgres locally too (Docker Compose), not SQLite. |
| Container registry | ECR in the **same region** as the ECS service [K] | |
| Region | One region for everything. `ap-south-1` (Mumbai) is a reasonable default for Indian users [J]; **use the region your event/account mandates** [?] | |
| Secrets | DB password in AWS Secrets Manager if time allows; otherwise as a service environment variable. **Never in Git.** | |

---

## 5. Decision register

Status values: **Accepted**, **Changed from v1**, **Deferred**. "Assumptions" lists what must stay true for the decision to hold.

| ID | Decision | Rationale | Rejected alternatives | Assumptions | Status |
|---|---|---|---|---|---|
| AD-001 | Next.js 15 + FastAPI + PostgreSQL | Meets the required stack; Postgres gives atomic conditional updates | SQLite in production (ephemeral container storage), NoSQL | Postgres reachable from API | Accepted |
| AD-002 | API on ECS Express Mode (Plan A) | App Runner closed to new customers [V]; ECS Express is AWS's recommended replacement [V] | App Runner, Lambda, EC2 as primary | Docker + account permissions | **Changed from v1** |
| AD-003 | Frontend on Amplify Hosting, Next.js pinned to 15.x | Documented support through 15 [V] | Next 16, static export, S3+CloudFront | Node 20/22 build image | Accepted (version pinned) |
| AD-004 | Claim = single conditional `UPDATE … WHERE status='OPEN'`; 0 rows → 409 | Atomic under concurrent requests on Postgres [K] | UI-only button disabling, read-then-write | Single DB, READ COMMITTED default [K] | Accepted |
| AD-005 | Explicit action endpoints instead of generic `PATCH /status` | Each action has distinct actor, payload and valid source state | Generic PATCH | None | **Changed from v1** |
| AD-006 | Demo identity via `X-Demo-User-Id`, validated against seeded users; labelled demo-only | Real auth is out of scope for the time | Cognito (later), client-sent role | Judges understand demo scope | Accepted (limitation disclosed) |
| AD-007 | Matching = bounding-box prefilter in SQL + Haversine in Python, default radius 5 km, nearest-first | Tiny data volume; no PostGIS needed | PostGIS, external geocoder | Request count in the hundreds, not millions | Accepted |
| AD-008 | Privacy: feed exposes approximate coordinates (rounded to 2 decimals) and distance rounded to 0.1 km; exact coordinates and address note only to owner and assigned vendor | v1 rule needed a data/API design | Return full request to everyone | None | **Changed from v1** |
| AD-009 | Final weight/amount stored on `scrap_requests`; no separate `transactions` table in MVP | Fewer joins and failure points | Separate `transactions` table | Reconsider after hackathon | **Changed from v1** |
| AD-010 | Rate snapshot copied onto the request at creation; server computes the estimate | Prevents client tampering and later rate changes altering history | Client-supplied values | None | Accepted |
| AD-011 | Money in `NUMERIC`, computed with `Decimal`, quantized to 0.01, exposed as JSON numbers | Avoids float drift; avoids Pydantic v2's Decimal-as-string JSON default [K] | Floats; integer paise | Display-only precision | Accepted |
| AD-012 | Lifecycle adds `release` (CLAIMED→OPEN) and household `cancel` (OPEN/CLAIMED→CANCELLED) | Prevents permanently stuck claims | Admin-only fixes | None | **Changed from v1** |
| AD-013 | DB in the default VPC, not public; security group allows port 5432 from the service | Safe, minimal networking | Public RDS | Default VPC exists [?] | Accepted |
| AD-014 | App creates tables and seeds demo data at startup, idempotently, behind `SEED_DEMO_DATA=true` | Avoids needing laptop → RDS connectivity | Manual SQL via laptop, Alembic | Single running task | Accepted (Alembic deferred) |
| AD-015 | Direct browser → API calls with explicit CORS; Next.js proxy route only in Plan C | Fewer moving parts | Always proxy | Backend has valid HTTPS | Accepted |
| AD-016 | All timestamps `TIMESTAMPTZ` in UTC; UI renders `Asia/Kolkata` | Avoids timezone bugs | Naive timestamps | Indian audience | Accepted |

---

## 6. Data model

### 6.1 Tables

**`users`**

| Column | Type | Notes |
|---|---|---|
| id | bigserial PK | |
| name | text NOT NULL | |
| role | text NOT NULL | CHECK in (`HOUSEHOLD`,`VENDOR`) |
| latitude | double precision NULL | Demo default location only |
| longitude | double precision NULL | Demo default location only |
| created_at | timestamptz NOT NULL default now() | |

**`scrap_rates`**

| Column | Type | Notes |
|---|---|---|
| id | bigserial PK | |
| scrap_type | text NOT NULL | e.g. `newspaper` |
| display_name | text NOT NULL | |
| rate_per_kg | numeric(10,2) NOT NULL CHECK (> 0) | **Indicative** |
| currency | char(3) NOT NULL default `INR` | |
| effective_from | timestamptz NOT NULL default now() | |
| is_active | boolean NOT NULL default true | Partial unique index on `scrap_type` WHERE `is_active` |

**`scrap_requests`**

| Column | Type | Notes |
|---|---|---|
| id | bigserial PK | |
| household_id | bigint NOT NULL FK users | |
| vendor_id | bigint NULL FK users | Set on claim |
| scrap_type | text NOT NULL | Must match an active rate at creation |
| quantity_kg | numeric(8,3) NOT NULL | CHECK between 0.1 and 500 |
| rate_per_kg | numeric(10,2) NOT NULL | Snapshot |
| estimated_value | numeric(12,2) NOT NULL | quantity × rate, quantized |
| latitude, longitude | double precision NOT NULL | Exact; CHECK lat in [-90,90], lng in [-180,180] |
| address_note | text NULL | ≤ 200 chars; exact pickup detail |
| status | text NOT NULL | CHECK in (`OPEN`,`CLAIMED`,`PICKED_UP`,`COMPLETED`,`CANCELLED`) |
| client_token | text NULL | P1 idempotency; unique with `household_id` when not null |
| final_weight_kg | numeric(8,3) NULL | Set on complete |
| final_amount | numeric(12,2) NULL | final_weight × snapshot rate |
| created_at, updated_at | timestamptz NOT NULL | |
| claimed_at, picked_up_at, completed_at, cancelled_at | timestamptz NULL | |

**Invariant constraints (database-level):**
- `OPEN` ⇒ `vendor_id IS NULL`
- `CLAIMED`, `PICKED_UP`, `COMPLETED` ⇒ `vendor_id IS NOT NULL`
- `COMPLETED` ⇒ `final_weight_kg IS NOT NULL AND final_amount IS NOT NULL`
- `CANCELLED` may retain `vendor_id` (audit)

**Indexes:** `(status, created_at)`, `(household_id)`, `(vendor_id)`, and the unique `(household_id, client_token)` where `client_token IS NOT NULL`.

**`request_events` (P1)** — `id, request_id FK, actor_id FK, event text, from_status, to_status, created_at`. Inserted in the **same transaction** as every status change. Used for the detail timeline and for debugging claim disputes.

### 6.2 Seed data (idempotent; every value is illustrative)

- Rates (placeholders, **not market data**): newspaper 15, cardboard 8, plastic 10, iron 25, aluminium 80 (₹/kg).
- Users: 2 households and 3 vendors. Place all five within about 2 km of each other (e.g., around the illustrative point 28.6139, 77.2090 used in v1) so the 5 km default radius shows results. **Verify the seeded distances with the Haversine function instead of assuming.**
- The demo needs at least 2 vendors (double-claim test); the race test (§15.2) uses 3.

### 6.3 Seeding rules
Seed only if `users` is empty. Wrap in a transaction. Safe on restart. Do not seed in a way that re-creates deleted demo data unexpectedly (guard with `SEED_DEMO_DATA`).

### 6.4 Numeric conventions
- Compute with `Decimal`; quantize to `0.01` using `ROUND_HALF_UP`.
- Store as `NUMERIC`.
- Expose money and quantities as JSON **numbers** (convert at the response boundary). The frontend may show an *estimate preview* (quantity × rate) but treats the server's value as authoritative.

---

## 7. State machine and authorization

### 7.1 Transitions

```text
                 ┌── release (assigned vendor) ──┐
                 ▼                               │
 OPEN ── claim (vendor) ──▶ CLAIMED ── pickup (assigned vendor) ──▶ PICKED_UP ── complete (assigned vendor, final weight) ──▶ COMPLETED
  │                           │
  └── cancel (owner) ─────────┴── cancel (owner) ──▶ CANCELLED
```

| Action | Actor | Requires | From → To | Side effects |
|---|---|---|---|---|
| create | HOUSEHOLD | valid input | — → `OPEN` | rate snapshot, estimate computed |
| claim | VENDOR | any vendor | `OPEN` → `CLAIMED` | set `vendor_id`, `claimed_at` |
| release | VENDOR | is assigned vendor | `CLAIMED` → `OPEN` | clear `vendor_id`, `claimed_at` |
| cancel | HOUSEHOLD | is owner | `OPEN`/`CLAIMED` → `CANCELLED` | set `cancelled_at` |
| pickup | VENDOR | is assigned vendor | `CLAIMED` → `PICKED_UP` | set `picked_up_at` |
| complete | VENDOR | is assigned vendor; `final_weight_kg` valid | `PICKED_UP` → `COMPLETED` | set final weight/amount, `completed_at` |

`PICKED_UP`, `COMPLETED` and `CANCELLED` are not cancellable. Household confirmation of completion is **P2**.

### 7.2 Implementation rule
Every transition is **one conditional UPDATE** whose WHERE clause includes the expected current status and, where relevant, the actor (`vendor_id = :actor`). Zero rows updated means "not allowed or no longer true" and maps to a 404/403/409 as in §8.5. Never read-then-write.

---

## 8. API contract (frozen at the end of Phase 0)

### 8.1 Identity (demo only)
Every `/api/*` call except `/api/demo/users`, `/api/rates` and health endpoints sends `X-Demo-User-Id: <integer>`. The backend loads that user and uses the **stored** role. This is **not authentication**: anyone can send any id. Disclose this limitation. Production replacement: Amazon Cognito with JWT validation [K].

### 8.2 Endpoints

| Method | Path | Actor | Purpose |
|---|---|---|---|
| GET | `/health` | none | Shallow liveness (used by the load balancer) |
| GET | `/ping` | none | Alias of `/health` (Express Mode's documented default path [V]) |
| GET | `/health/db` | none | `SELECT 1`; for manual checks only |
| GET | `/api/demo/users` | none | List seeded demo identities |
| GET | `/api/rates` | none | Active indicative rates + disclaimer |
| POST | `/api/requests` | HOUSEHOLD | Create request |
| GET | `/api/requests/nearby` | VENDOR | Open requests near `lat,lng` |
| GET | `/api/requests/mine` | either | Household: own requests. Vendor: assigned requests |
| GET | `/api/requests/{id}` | either | Detail with visibility rules |
| POST | `/api/requests/{id}/claim` | VENDOR | Atomic claim |
| POST | `/api/requests/{id}/release` | VENDOR | Give a claimed request back |
| POST | `/api/requests/{id}/cancel` | HOUSEHOLD | Cancel own request |
| POST | `/api/requests/{id}/pickup` | VENDOR | Mark picked up |
| POST | `/api/requests/{id}/complete` | VENDOR | Complete with final weight |

**FastAPI route-order rule:** declare `/api/requests/nearby` and `/api/requests/mine` **before** `/api/requests/{id}`, otherwise the literal words get parsed as an id and return 422 [K].

### 8.3 Request/response shapes

**Create — `POST /api/requests`**
```json
{
  "scrap_type": "newspaper",
  "quantity_kg": 5,
  "latitude": 28.6139,
  "longitude": 77.209,
  "address_note": "Gate 2, near the park",
  "client_token": "optional-uuid"
}
```
The client sends **no** rate, value, status or household id. Response `201` is a **Detail** object (below) with `status: "OPEN"`.

**Nearby — `GET /api/requests/nearby?lat=&lng=&radius_km=5&limit=50`**
`lat`, `lng` required. `radius_km` default 5, max 25. `limit` default 50, max 100. Returns **Summary** objects, nearest first (ties by `created_at`).

**Summary** (feed item; what any vendor may see for an `OPEN` request):
```json
{
  "id": 101,
  "scrap_type": "newspaper",
  "quantity_kg": 5.0,
  "rate_per_kg": 15.0,
  "estimated_value": 75.0,
  "currency": "INR",
  "status": "OPEN",
  "distance_km": 1.4,
  "approx_latitude": 28.61,
  "approx_longitude": 77.21,
  "created_at": "2026-10-10T08:00:00Z"
}
```
(Values are illustrative.)

**Detail** (owner or assigned vendor only) = Summary fields **plus** `household_name`, `vendor_name`, exact `latitude`/`longitude`, `address_note`, `claimed_at`, `picked_up_at`, `completed_at`, `cancelled_at`, `final_weight_kg`, `final_amount`, and (P1) `events[]`. `distance_km` is omitted in Detail unless the caller supplies `lat`/`lng`.

**Complete — `POST /api/requests/{id}/complete`**
```json
{ "final_weight_kg": 4.6 }
```
Server sets `final_amount = final_weight_kg × snapshot rate_per_kg` (quantized). Vendors cannot override the rate in the MVP.

**Rates — `GET /api/rates`**
```json
{
  "disclaimer": "Indicative demo rates. Final settlement depends on weight and material quality.",
  "rates": [
    {"scrap_type": "newspaper", "display_name": "Newspaper", "rate_per_kg": 15.0, "currency": "INR", "is_indicative": true}
  ]
}
```

### 8.4 Visibility rules
- Owner household and assigned vendor: full Detail.
- Other vendors: Summary only, and only while `OPEN`. A non-`OPEN` request not assigned to them returns **404** (not 403) so existence isn't leaked.
- Other households: 404.
- The feed never returns exact coordinates, `address_note` or household identity.

### 8.5 Errors
Domain errors use one envelope:
```json
{ "error": { "code": "ALREADY_CLAIMED", "message": "This request was just claimed by another vendor." } }
```

| HTTP | Code | When |
|---|---|---|
| 401 | `MISSING_IDENTITY` | Header missing or user unknown |
| 403 | `WRONG_ROLE` / `NOT_ASSIGNED` / `NOT_OWNER` | Role or ownership check failed |
| 404 | `NOT_FOUND` | Missing or not visible to the caller |
| 409 | `ALREADY_CLAIMED` | Claim on a non-`OPEN` request |
| 409 | `INVALID_TRANSITION` | Action not valid from the current status |
| 422 | (FastAPI default body) | Validation failure; the frontend must handle this shape too |
| 503 | `DB_UNAVAILABLE` | Database not reachable |

### 8.6 Validation rules
`quantity_kg` between 0.1 and 500; `scrap_type` must exist in active rates; latitude in [-90, 90]; longitude in [-180, 180]; `address_note` ≤ 200 chars; `radius_km` ≤ 25; `final_weight_kg` between 0.1 and 1000.

---

## 9. Location matching and privacy

1. Vendor supplies `lat`/`lng` per feed call (device location or a preset). Stored user coordinates are only a demo default.
2. SQL prefilter by bounding box: `dlat = radius_km / 111.0`; `dlng = radius_km / (111.0 × cos(radians(lat)))`.
3. Exact distance with Haversine in Python (Earth radius 6371.0088 km); then filter ≤ radius; sort ascending; apply limit.
4. Response rounds distance to 0.1 km and coordinates to 2 decimals (about 1.1 km of latitude resolution [K]).
5. Known limitation: repeated queries from many positions can narrow down a household's location. Acceptable for a demo; disclose.
6. Use only demo coordinates and demo identities in public presentations. Never enter real phone numbers or real addresses.

```python
from math import radians, sin, cos, asin, sqrt

def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0088
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))
```

---

## 10. Frontend plan

### 10.1 Pages (all `"use client"`; fetch data in the browser)

| Route | Role | Purpose | Endpoints |
|---|---|---|---|
| `/` | none | Pick a demo identity (household or vendor) | `GET /api/demo/users` |
| `/household/new` | household | Form: type, kg, location, note; shows estimate | `GET /api/rates`, `POST /api/requests` |
| `/household/requests` | household | My requests with status | `GET /api/requests/mine`, `cancel` |
| `/vendor/feed` | vendor | Nearby open requests + Claim | `GET /api/requests/nearby`, `claim` |
| `/vendor/pickups` | vendor | My assigned requests; actions | `GET /api/requests/mine`, `pickup`, `complete`, `release` |
| `/requests/[id]` | both | Detail (+ timeline in P1) | `GET /api/requests/{id}` |

Use the dynamic route `/requests/[id]` with `useParams()` rather than a query-string page. A page using `useSearchParams()` needs a Suspense boundary or `next build` fails [K].

### 10.2 UX rules
- Mobile-first; tap targets ≥ 44 px; the primary action is always visible.
- Every list has loading, empty and error states. No dead buttons.
- Claim: disable the button while the request is in flight (prevents double submit); on **409** show "Taken by another vendor" and refetch the feed; never optimistically assume success.
- Location picker: browser geolocation **plus** a preset dropdown of demo locations. Geolocation can be denied, unavailable or coarse, so presets keep the demo reliable.
- Label every price "Indicative". Show times in `Asia/Kolkata`.
- Polling (P1): refetch the feed every ~10 s; manual refresh button always available.
- No decorative map. A sorted list with distance labels is the deliverable.

### 10.3 Structure
```
frontend/
  app/            layout.tsx, page.tsx, household/..., vendor/..., requests/[id]/page.tsx
  components/     RequestCard, StatusBadge, LocationPicker, ErrorBanner, EmptyState
  lib/            api.ts (fetch wrapper + header), types.ts, demoUser.tsx (context), format.ts
  .env.example    NEXT_PUBLIC_API_BASE_URL=
```

### 10.4 Environment
`NEXT_PUBLIC_API_BASE_URL` is **inlined at build time**. Set it in the Amplify environment variables **before** the build; changing it requires a rebuild [K]. Verify in the browser's network tab that requests go to the intended API.

### 10.5 API client contract mode
`lib/api.ts` has a `NEXT_PUBLIC_USE_MOCK=true` mode that returns JSON from `contract/examples/*.json`, so the frontend is buildable before the API exists (§17).

---

## 11. Backend plan

### 11.1 Structure
```
backend/
  app/
    main.py            app, CORS, startup (DB init with retry, seed), routers
    config.py          settings: DATABASE_URL, CORS_ORIGINS, DEFAULT_RADIUS_KM, SEED_DEMO_DATA
    db.py              engine, session, get_db
    models.py          SQLAlchemy models
    schemas.py         Pydantic schemas (Summary, Detail, requests)
    deps.py            get_actor (header), require_role
    geo.py             haversine, bounding box, rounding
    services/requests.py   create, nearby, claim, transitions
    routers/           health.py, rates.py, demo.py, requests.py
    seed.py
  tests/               test_transitions.py, test_claim_race.py
  Dockerfile  requirements.txt  docker-compose.yml  .env.example
```

### 11.2 Atomic claim (reference sketch, SQLAlchemy 2.x)

```python
from sqlalchemy import update, func

def claim_request(db, request_id: int, vendor_id: int) -> bool:
    result = db.execute(
        update(ScrapRequest)
        .where(ScrapRequest.id == request_id, ScrapRequest.status == "OPEN")
        .values(status="CLAIMED", vendor_id=vendor_id,
                claimed_at=func.now(), updated_at=func.now())
    )
    db.commit()
    return result.rowcount == 1   # False → 404 if row missing, else 409 ALREADY_CLAIMED
```

Under PostgreSQL's default isolation, a second concurrent update waits for the first to commit, re-evaluates the WHERE clause, finds status no longer `OPEN`, and updates zero rows [K]. The race test in §15.2 proves this on your stack. After a zero-row result, do a separate read to decide between 404 and 409. Log every outcome: `claim_attempt request_id=… vendor_id=… result=success|conflict|not_found`.

Other transitions use the same pattern with additional predicates, for example `pickup`: `WHERE id=:id AND status='CLAIMED' AND vendor_id=:actor`. In the same DB transaction, write the `request_events` row (P1).

### 11.3 CORS
```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,          # e.g. http://localhost:3000 + the Amplify URL
    allow_origin_regex=r"https://.*\.amplifyapp\.com", # removes the URL chicken-and-egg during first deploy
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Demo-User-Id"],
)
```
The custom `X-Demo-User-Id` header triggers a preflight request, so it **must** be in `allow_headers`. No cookies are used, so credentials are not enabled. The regex allows any Amplify-hosted origin; acceptable for demo data, and you should replace it with the exact URL afterwards [J].

### 11.4 Startup resilience
On startup: retry the DB connection for up to about 60 seconds, then `create_all`, then idempotent seed. If the DB is still unreachable, keep serving `/health` (so the container isn't killed) and return `503 DB_UNAVAILABLE` on API calls.

### 11.5 Container
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
`requirements.txt` (unpinned list; after the first working local install, run `pip freeze` and pin exact versions rather than copying versions from memory): `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `psycopg[binary]`, `pydantic`, `pydantic-settings`, `httpx` (tests only).
Database URL format for psycopg 3: `postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME`. URL-encode special characters in the password, or generate an alphanumeric one [K].

### 11.6 Local development
```yaml
# backend/docker-compose.yml (development only)
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: kabaad
      POSTGRES_PASSWORD: kabaad_dev
      POSTGRES_DB: kabaadlink
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes:
  pgdata:
```
`DATABASE_URL=postgresql+psycopg://kabaad:kabaad_dev@localhost:5432/kabaadlink`. Develop and test against Postgres locally. Each ECS deployment takes minutes [J], so batch backend fixes instead of iterating on the cloud.

---

## 12. AWS deployment runbook (Plan A)

### 12.1 T+0 checks (Person B, 15 min)
- [ ] Which account/credits does the event give you? Free or Paid plan? [?]
- [ ] Region chosen and allowed.
- [ ] Console shows ECS Express Mode, ECR, RDS, Amplify as usable (not blocked by Free-plan restriction or org policy).
- [ ] Default VPC exists in the region.
- [ ] AWS Budgets alert created (e.g., a low USD threshold).
- [ ] App Runner "create service" tried for 2 minutes; if it works, note it as Plan A′.

### 12.2 Database (start in the first 30 minutes; provisioning takes minutes [K])
1. RDS for PostgreSQL: small burstable class, single-AZ, small storage [J], database name `kabaadlink`, **public access = No**, default VPC.
2. Generate an alphanumeric master password; store it in a password manager / Secrets Manager, never in Git.
3. Security group: allow inbound TCP 5432 **from the ECS service's security group**, or as a simpler hackathon choice from the default VPC CIDR [J].

### 12.3 API image and service
1. Create an ECR repository in the chosen region.
2. Authenticate Docker to ECR and push with an **immutable tag** (git short SHA), not `latest`, so each deployment is a distinct, traceable image:
   `aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com`
   `docker buildx build --platform linux/amd64 -t <account>.dkr.ecr.<region>.amazonaws.com/kabaadlink-api:<sha> --push backend/`
   Build for `linux/amd64` unless you deliberately configure the task for ARM. On Apple-silicon laptops an unspecified build commonly yields "exec format error" at runtime [K].
3. Create the ECS Express Mode service (console, or the AWS CLI's `create-express-gateway-service` command [V], which takes a task execution role, an infrastructure role and an image). Set:
   - Container image: the ECR URI with your tag
   - **Container port: 8000** (default is 80) [V]
   - **Health check path: `/health`** (default is `/ping`) [V]
   - Environment variables: `DATABASE_URL`, `CORS_ORIGINS`, `SEED_DEMO_DATA=true`
   - Roles: the console may offer to create them; if not, create them in IAM using the AWS-managed policies named in the Express Mode documentation (the infrastructure role uses `AmazonECSInfrastructureRoleforExpressGatewayServices` [V]); the execution role needs ECR pull, CloudWatch Logs, and Secrets Manager read if you use it [V from the API reference].
4. Wait for the generated HTTPS URL; open `https://<url>/health` in a browser.
5. If the DB isn't reachable yet, fix the security group (§12.2 step 3); the container retries on its own (§11.4).
6. To redeploy: push a new tag and update the Express service to that image (use the Express update path, not a manually edited task definition [V from the CLI reference listing]).

### 12.4 Frontend on Amplify (Person A)
1. Connect the GitHub repo in Amplify Hosting. For a monorepo set the **monorepo root directory to `frontend`**; Amplify then sets the `AMPLIFY_MONOREPO_APP_ROOT` environment variable, which you must set manually if the app already exists [V].
2. Set environment variables: `NEXT_PUBLIC_API_BASE_URL=https://<api-url>`; set the Node version through the Amplify build settings (20 or 22) [V].
3. If you hand-write `amplify.yml` for the monorepo, it needs the `appRoot` key [V]. A Next.js SSR build uses `baseDirectory: .next`. One worked example uses it with `appRoot`; if Amplify can't find the build output, compare with the current Amplify monorepo documentation, since some variants express paths from the repository root [V/K]. Template:
```yaml
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - nvm use 20
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
```
4. Deploy ordering: (a) API first with `CORS_ORIGINS=http://localhost:3000`; (b) Amplify using the API URL; (c) optionally replace the regex CORS rule with the exact Amplify URL and redeploy the API.
5. Smoke test from a phone on mobile data.

### 12.5 Plan C notes (only if Plan A and B fail)
Add a Next.js route handler that forwards `/api/*` to the backend. The browser then talks only to the HTTPS Amplify origin, so there is no CORS or mixed-content issue. Server-side runtime environment variables on Amplify may need to be written into `.env.production` during the build [K, from a third-party source]; test early.

### 12.6 Cost and teardown
Load balancers, Fargate tasks and RDS bill hourly [K]. After the event: delete the ECS service (confirm its load balancer is gone), the RDS instance, ECR images, the Amplify app, and review Billing. Keep the budget alert until then.

---

## 13. Cross-component impact analysis

| Decision | API | Database | Frontend | Security | Tests | Deployment | Docs | Sequencing |
|---|---|---|---|---|---|---|---|---|
| AD-002 ECS Express | `/health` + `/ping`; port 8000 | RDS in default VPC | `API_BASE_URL` = ELB URL | HTTPS provided [V] | Smoke test on deployed URL | ECR + roles + health override | Runbook §12 | Image must exist before service |
| AD-004 atomic claim | 409 `ALREADY_CLAIMED` | Conditional UPDATE | Handle 409 + refetch | Prevents double assignment | Race test | None | Contract | B builds early; A needs 409 UI |
| AD-005 action endpoints | 5 POST actions | Predicates per action | One button per action | Per-action authorization | Transition tests | None | Contract | Freeze before either side codes |
| AD-006 demo identity | Header on every call | Seeded users | Identity context + picker | **Spoofable; disclosed** | Role/ownership tests | CORS allows the header | Limitation noted | Seed before any UI work |
| AD-008 privacy | Summary vs Detail | Exact data stored | Never expects exact coords in feed | Reduces exposure | Test that feed hides exact fields | None | Contract | Schemas defined before UI cards |
| AD-009 final data on request | `complete` takes weight | Columns + CHECK | Weight input on complete | None | Test COMPLETED constraint | None | Model | Needed before `complete` UI |
| AD-011 numeric convention | Numbers in JSON | NUMERIC | Display only | None | Rounding test | None | §6.4 | Settle before schemas |
| AD-013 private DB | `DB_UNAVAILABLE` path | Not public | None | Smaller attack surface | `/health/db` check | SG rule | Runbook | Start RDS in first 30 min |
| AD-014 auto-seed | None | Idempotent seed | Needs known demo ids | Seed gated by env var | Seed idempotency | `SEED_DEMO_DATA=true` | README | First deploy seeds DB |
| AD-015 direct CORS | None | None | Needs exact API URL at build | CORS regex scope | OPTIONS test | Deploy order | §12.4 | Backend URL before frontend build |

**Consistency checks performed on v2:** (1) every endpoint maps to a transition or read and to a screen; (2) every transition has an actor rule and a database predicate; (3) every UI button maps to exactly one endpoint; (4) every constraint in §6.1 is reachable by some transition and none is violated by any transition (`release` clears `vendor_id` so `OPEN ⇒ vendor_id NULL` holds; `cancel` retains it, which the constraint allows); (5) the feed shape never contains fields that §8.4 forbids; (6) the schedule in §17 places every dependency before its dependent.

---

## 14. Failure-mode analysis (what could break)

Likelihood (L) and Impact (I): H/M/L.

| # | What breaks | L | I | Detection | Mitigation |
|---|---|---|---|---|---|
| 1 | App Runner unavailable | H [V] | H | Console error at T+0 | Plan A (ECS Express) |
| 2 | Free plan or org policy blocks ECS, load balancer or RDS | M [?] | H | T+0 checklist | Upgrade to Paid (credits still apply [V]) or ask organizers; Plans B/C |
| 3 | No Docker on any laptop | M | H | T+0 | Plan B (zip-based Lambda) or build in a cloud shell/CI [K] |
| 4 | Image built for the wrong CPU architecture | M | H | Task crash "exec format error" in logs | `--platform linux/amd64` |
| 5 | Health check fails (defaults: port 80, `/ping`) [V] | H if not overridden | H | Service never becomes healthy | Set port 8000 + `/health`; keep `/ping` alias |
| 6 | API can't reach RDS | M | H | `/health/db` fails; logs | SG rule, same VPC, retry loop |
| 7 | DB URL breaks on special characters in the password | M | M | Auth/parse error in logs | Alphanumeric password or URL-encode |
| 8 | CORS preflight rejected | H if forgotten | H | Browser console | `allow_headers` includes `X-Demo-User-Id`; test OPTIONS |
| 9 | Frontend calls an `http://` API from an `https://` page | M | H | Mixed-content error | Use the HTTPS URL; Plan C proxy |
| 10 | `NEXT_PUBLIC_API_BASE_URL` stale (baked at build) | M | M | Network tab shows wrong URL | Rebuild after changing it |
| 11 | Unsupported Next.js version on Amplify | M | H | Build failure | Pin 15.x [V] |
| 12 | Monorepo misconfiguration | M | M | Amplify build log | Root directory + `AMPLIFY_MONOREPO_APP_ROOT` [V] |
| 13 | `/nearby` shadowed by `/{id}` | H if ordered wrong | M | 422 | Route order (§8.2) |
| 14 | Double claim | M | H | Race test | Conditional UPDATE (AD-004) |
| 15 | Request stuck in CLAIMED | M | M | Demo walkthrough | `release` / `cancel` |
| 16 | Geolocation denied or inaccurate | H | M | Empty feed | Presets; radius control; seeded data within radius |
| 17 | Seed data too far apart, feed empty | M | H | Test feed | Seed within ~2 km; verify with Haversine |
| 18 | Timezone confusion | M | L | Odd times in UI | UTC storage, IST rendering |
| 19 | Decimal serialized as a string | M | M | Type errors in UI | §6.4 convention; schema test |
| 20 | Seed duplicates on restart | M | M | Duplicate users | Seed only when empty |
| 21 | Double-click creates two requests | M | L | Duplicates | Disable button; P1 `client_token` |
| 22 | Cost overrun / forgotten resources | M | M | Budget alert | Budget + teardown (§12.6) |
| 23 | Secrets committed to Git | M | H | Secret scan before push | `.gitignore`, `.env.example`; rotate immediately if leaked |
| 24 | Spoofed identity | H (by design) | L for demo | — | Disclose; Cognito later |
| 25 | Stale feed after another vendor claims | H | M | Manual test | Polling + 409 handling |
| 26 | Late-discovered build failure | M | H | — | Walking skeleton at T+100 |
| 27 | Venue Wi-Fi fails during demo | M | H | — | Phone hotspot; recorded backup video; local `docker compose` run |
| 28 | ECR and ECS in different regions | L | M | Pull error | One region everywhere |
| 29 | Slow cloud iteration time | H | M | — | Develop locally; batch fixes |
| 30 | Time overrun | H | H | Gate misses | Gates (§17) + cut lines (§3.3) |

---

## 15. Testing

### 15.1 Local before cloud
Run Postgres via Compose; run the API; open `/docs`; execute the flow with `curl`/Swagger; then connect the frontend.

### 15.2 Claim race test (reference sketch)
```python
# tests/test_claim_race.py  — usage: python test_claim_race.py <BASE_URL> <REQUEST_ID> <VENDOR_ID> <VENDOR_ID> ...
import sys, concurrent.futures, httpx

base, req_id = sys.argv[1], int(sys.argv[2])
vendor_ids = [int(v) for v in sys.argv[3:]]

def claim(vid):
    r = httpx.post(f"{base}/api/requests/{req_id}/claim",
                   headers={"X-Demo-User-Id": str(vid)}, timeout=15)
    return vid, r.status_code

with concurrent.futures.ThreadPoolExecutor(max_workers=len(vendor_ids)) as ex:
    results = list(ex.map(claim, vendor_ids))

print(results)
winners = [v for v, s in results if s == 200]
assert len(winners) == 1, f"expected exactly one winner, got {results}"
assert all(s in (200, 409) for _, s in results), f"unexpected status in {results}"
```
Run it against local and against the deployed API using a fresh `OPEN` request and 3 vendor ids.

### 15.3 Acceptance checklist (run on the deployed stack)
- [ ] `GET /health` returns 200 from a phone on mobile data
- [ ] CORS works from the Amplify origin (including the preflight)
- [ ] Household creates a request; invalid quantity (0, negative, 501) rejected with 422
- [ ] Unknown `scrap_type` rejected
- [ ] Server-computed `estimated_value` correct (e.g., 5 kg × 15 = 75.00)
- [ ] Request visible in the vendor feed with a calculated distance and no exact coordinates
- [ ] Vendor claims; the request leaves the open feed
- [ ] A second vendor's claim returns 409; the UI shows the "taken" message
- [ ] Race test passes (exactly one 200)
- [ ] Wrong role/ownership actions return 401/403/404 as specified
- [ ] Invalid transitions return 409 `INVALID_TRANSITION` (e.g., `complete` from `CLAIMED`)
- [ ] `pickup` then `complete` with a final weight; `final_amount` correct
- [ ] Both sessions show `COMPLETED` after a refresh
- [ ] (P1) `release` returns the request to the feed; `cancel` works from `OPEN` and `CLAIMED`
- [ ] Restarting/redeploying the API keeps all data (proves durable persistence)
- [ ] No secrets in the repository; `.env` ignored
- [ ] Prices labelled "Indicative" everywhere

---

## 16. Security, privacy and honesty

**Implemented:** server-side validation; ORM parameterized queries; HTTPS end-to-end [V for the Express URL, K for Amplify]; private database; explicit CORS; no secrets in Git; feed hides exact location and household identity; server-computed prices; role/ownership checks via the seeded identity.

**Known limitations (state them in the pitch and README):** demo identity is not authentication; no rate limiting; no abuse protection on the public API; approximate location can be narrowed by repeated queries; no payment or settlement; rates are placeholders.

**Claims to avoid:** "optimized routes" (it is distance sorting); "live market rates" (seeded values); "production-secure"; "durable data" before you test a redeploy; measured environmental or income impact (hypotheses only); "AI-powered" (nothing here is).

---

## 17. Two-person work split and schedule

### 17.1 Roles

| | **Person A — Frontend & Experience** | **Person B — Backend & Cloud** |
|---|---|---|
| Owns folder | `frontend/` | `backend/` |
| Owns AWS pieces | Amplify Hosting | RDS, ECR, ECS Express Mode, CloudWatch, Budgets |
| Owns docs | Demo script, pitch, submission write-up, README (usage) | Contract examples, README (architecture/run), runbook |
| Shared | `contract/` (API examples) and `docs/` — **changes require the other person's acknowledgment** | |

**Why this split [J]:** B has the longest critical path (RDS, image, ECS, claim logic), so B carries all infrastructure. A has the larger breadth of screens, so A also owns the walkthrough and submission materials. If one of you is clearly stronger at backend, swap the roles; the structure holds.

### 17.2 Rules that keep two people from colliding
1. **Disjoint folders.** A never edits `backend/`; B never edits `frontend/`.
2. **Contract-first.** Phase 0 produces `contract/examples/*.json` (one file per endpoint response) and the frozen §8. A builds against these examples via `NEXT_PUBLIC_USE_MOCK=true` until the API is deployed.
3. **Contract change protocol:** announce the change, update `contract/` and §8, partner acknowledges, then code. No silent changes.
4. **Branching:** short-lived feature branches merged to `main` frequently. Amplify rebuilds on pushes to the connected branch; broken frontend code on `main` breaks the demo, so A runs `npm run build` locally before merging.
5. **Backend deploys are manual and owned by B** (`backend/deploy.sh`: build, push with SHA tag, update service).
6. **Sync points:** a 3-minute sync at every gate and at least once an hour: done / next / blocked / contract changes.
7. **Cross-training at G1:** each person performs one deploy of the other's component (A runs a backend redeploy, B triggers an Amplify build), so either of you can recover alone.
8. **Blocker rule:** anything blocking for more than 15 minutes is raised immediately. Infra debugging is done as a pair.

### 17.3 Schedule

T = minutes from now, assuming a 360-minute budget. Submit by about T+330 and keep the remainder as buffer.

**Phase 0 — Align and start long-lead items (T+0 → T+25)**

| Person A | Person B | Joint |
|---|---|---|
| Create repo with `frontend/ backend/ contract/ docs/`; `.gitignore` (incl. `.env`); confirm Node 20/22 and Docker available; Builder Center profile/rules read | §12.1 checks; **start RDS creation immediately**; create ECR repo and Budget alert | Write `contract/examples/*.json`; confirm §5 decisions, region, who-does-what |

**Gate G0 (T+25):** contract frozen; RDS provisioning; repo skeleton pushed; AWS service availability known. If ECS Express isn't usable, choose Plan B or C now.

**Phase 1 — Walking skeleton (T+25 → T+100)**

| Person A | Person B |
|---|---|
| Next.js 15 skeleton, Tailwind, demo-user context and picker, `api.ts` with mock mode; household form and vendor feed UI against mock data; **connect Amplify to the repo by ~T+60 and deploy the skeleton** | FastAPI skeleton, config, `/health` + `/ping`; models, constraints, startup init + idempotent seed; `rates`, `demo/users`, `create`, `nearby`, `mine`; Compose Postgres; Dockerfile; push image; create ECS Express service by ~T+90 |

**Gate G1 (T+100) — walking skeleton:** Amplify URL loads; `https://<api>/health` reachable; the deployed frontend successfully calls the deployed API (CORS proven); `/api/demo/users` returns seeded users. **Cross-training deploys happen here.** If G1 fails by T+110, start Plan B/C in parallel.

**Phase 2 — Full P0 flow (T+100 → T+190)**

| Person A | Person B |
|---|---|
| Switch `api.ts` to the real API; household requests page; vendor feed with Claim and 409 handling; vendor pickups page with `pickup`/`complete` (weight input); loading/empty/error states | `claim`, `pickup`, `complete` as conditional updates with role/ownership checks; error envelope; privacy shaping (Summary vs Detail); `GET /requests/{id}`; race test; confirm the DB connection in the cloud; then `release`/`cancel` |

**Gate G2 (T+190):** the full P0 flow works on the deployed stack, passing the §15.3 P0 items.

**Phase 3 — Harden and polish (T+190 → T+270)**

| Person A | Person B |
|---|---|
| Mobile polish; P1: polling, detail page, timeline; demo script and pitch notes; README usage section | P1: events table, structured logs; tighten CORS to the exact origin; run race test on deployed API; review logs; redeploy-persistence test; README architecture section |
| **Joint:** run the entire §15.3 checklist together on phones and laptops | |

**Gate G3 (T+270) — FEATURE FREEZE.** Only critical bug fixes after this point.

**Phase 4 — Rehearse and submit (T+270 → T+330)**
Both: rehearse the demo twice; record a backup video if permitted; verify the live URL and repo from an incognito window and a phone; finalize the submission form (Builder Center or whatever your rules require [?]); confirm the submission is actually saved.

**Phase 5 — Buffer (T+330 → T+360):** no new work.

### 17.4 Compression if less time remains

| Time left | Do | Drop |
|---|---|---|
| ~4 h | All P0; `cancel`/`release` only if G2 passes with ≥ 45 min left | Events table, `client_token`, polling, detail page, README polish |
| ~3 h | Create → feed → claim → pickup → complete; one household and one vendor screen each; deploy at T+60 | Everything in §3.2 |
| ~2 h | Same flow, one UI shell; seed data; deploy the skeleton first | `mine` pages merged into inline status; no cancel/release |

### 17.5 Task ownership at a glance

| Deliverable | Owner | Needs from partner |
|---|---|---|
| `contract/examples/*.json` | B drafts, A reviews | — |
| Seed identities and ids | B | Ids to A at G0 |
| RDS, ECR, ECS | B | — |
| Amplify app + env vars | A | API URL from B at ~T+90 (A can use a placeholder until then) |
| CORS final origin | B | Amplify URL from A at ~T+60 |
| Household and vendor screens | A | Real API at G1 |
| State machine and atomic updates | B | 409 UX from A |
| Claim race test | B | — |
| Full acceptance run | Both | — |
| Demo script and pitch | A | B reviews the claims in §16 |
| README | A (usage), B (architecture) | — |

---

## 18. Demo script (about 90 seconds)

1. **Problem (10 s):** Households can't reliably arrange scrap pickups; vendors waste trips finding supply.
2. **Household device (laptop):** pick the demo household → create "5 kg newspaper" → show the indicative estimate (75.00 if the placeholder rate is 15).
3. **Vendor device (phone):** pick Vendor A → the request appears with a distance label.
4. **Claim** on the phone. The request leaves the feed.
5. **Second vendor:** on another browser window, Vendor B tries the same claim → "Taken by another vendor" (409). *(Open Vendor B's feed before step 4 so the stale request is visible; claim it after A has already claimed.)*
6. **Vendor A:** pickup → complete with a final weight (e.g., 4.6 kg) → show the final amount.
7. **Refresh both devices:** status persists.
8. **Architecture (15 s):** Next.js on Amplify → FastAPI on ECS Express Mode → PostgreSQL on RDS, deployed on AWS.
9. **Close (10 s):** present benefits as hypotheses to validate, not measured results; state the demo-identity limitation.

**Pre-demo setup:** reset by creating a fresh request; keep a spare request seeded; use demo identities only; have a phone hotspot and the backup video ready.

---

## 19. Assumptions to verify (owner, deadline)

| # | Assumption | How to verify | Owner | By | Fallback |
|---|---|---|---|---|---|
| 1 | Docker works on at least one laptop | `docker version` | A | T+10 | Plan B |
| 2 | ECS Express Mode, load balancers, RDS usable on the account | Console + §12.1 | B | T+15 | Upgrade plan / ask organizers / Plans B, C |
| 3 | Default VPC exists in the region | VPC console | B | T+15 | Create a VPC or use Plan B |
| 4 | Event rules permit these services and the repo workflow | Read the event page | A | T+20 | Adapt |
| 5 | Credits/billing visible and budget set | Billing console | B | T+20 | — |
| 6 | Amplify build succeeds with Next.js 15 + Node 20/22 | First skeleton build | A | T+65 | Adjust Node via build settings |
| 7 | App Runner (if ever needed) | Try creating a service | B | T+15 | Plan A |
| 8 | Seeded distances fall within the radius | Compute with Haversine | B | T+90 | Move seed coordinates |
| 9 | Redeploy keeps data | Redeploy and re-read | B | T+200 | Fix DB config |
| 10 | Submission requirements (Builder Center publication, repo visibility) | Event page | A | T+20, again at T+270 | — |

---

## 20. Submission checklist

- [ ] Public frontend URL opens from an incognito window and a phone on mobile data
- [ ] API `/health` OK; full flow works from a second network
- [ ] Repository accessible to judges; README includes the architecture diagram, run instructions, limitations, and the "indicative prices" note
- [ ] No secrets in the repository or its history
- [ ] Demo identities only; no real personal data
- [ ] Backup demo video recorded (if permitted)
- [ ] Event submission/Builder Center item saved and visible [?]
- [ ] Budget alert active; teardown planned for after judging

---

## 21. Final consistency audit

| Check | Result |
|---|---|
| Every v1 requirement is retained or explicitly changed (AD-002, 005, 008, 009, 012) | Pass |
| Endpoint list (§8.2) matches the pages (§10.1) and the transitions (§7.1) | Pass |
| Every transition has: actor rule, source status, DB predicate, test | Pass (§7, §11.2, §15) |
| DB constraints (§6.1) are consistent with every transition's side effects | Pass (traced for `release`, `cancel`, `complete`) |
| Privacy rule (§8.4) reflected in schema design (Summary vs Detail) and in tests | Pass |
| Defaults that would break ECS Express (port 80, `/ping`) are explicitly overridden and aliased | Pass [V] |
| Next.js version pinned to a version Amplify documents as supported | Pass [V] |
| Schedule dependencies: RDS before DB tests; image before ECS; API URL before Amplify build; Amplify URL before final CORS | Pass |
| Both people can work from T+25 without waiting on each other (contract examples + mock mode) | Pass |
| Unverified items are tagged and listed in §19 | Pass |
| Code samples executed | **No** — reference sketches only; test locally first |

*End of document.*

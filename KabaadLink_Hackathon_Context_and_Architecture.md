# KabaadLink — Hackathon Project Context, Architecture & Execution Plan

**Project:** KabaadLink  
**Purpose:** A localized marketplace connecting households with scrap vendors (kabadiwalas) to make scrap collection more reliable, transparent, and efficient.  
**Team:** 2 people  
**Time constraint:** Less than 6 hours remaining  
**Required stack:** Next.js frontend, Python backend, SQL database  
**Deployment requirement:** Application must be deployed on AWS  
**Current stage:** Discussing ideas and architecture; the exact AWS Builder Center workflow and credit eligibility still need verification.

---

## 1. Executive Summary

KabaadLink is a mobile-first, hyperlocal scrap pickup marketplace. Households publish what recyclable scrap they have, where it is located, and when it can be collected. Nearby vendors see open requests, assess the material and estimated value, claim a pickup, and update its status after collection.

The hackathon objective is **not** to build every feature of a production marketplace. It is to demonstrate a reliable end-to-end transaction:

1. A household creates a scrap pickup request.
2. The request is saved in SQL.
3. A vendor sees the request in a nearby feed.
4. The vendor claims it.
5. The request cannot be claimed by a second vendor.
6. The vendor marks it picked up/completed.
7. The final status persists after refresh.

The strongest demo is a functioning workflow backed by real API and database operations—not a collection of static screens.

## 2. Problem Statement

### Problem

- **Households:** Often lack a dependable way to sell scrap, compare indicative prices, and arrange collection.
- **Scrap vendors:** Waste time travelling around to find households that actually have scrap available.
- **Recycling ecosystem:** Price opacity and uncoordinated collection make transactions less predictable and collection trips potentially less efficient.

### Proposed Solution

KabaadLink connects household scrap requests with nearby kabadiwalas through:

- Location-pinned scrap pickup requests.
- Transparent, clearly labelled **indicative** rate cards.
- A localized vendor feed of available requests.
- Safe pickup claiming so the same request cannot be assigned to multiple vendors.
- Pickup status tracking and transaction records.
- Distance-based matching, with route optimization as a later enhancement.

### Value Proposition

**Households get clearer pricing and more predictable collection; vendors discover available inventory before travelling.**

Any claimed reduction in travel time, increase in vendor income, or increase in recycling must be treated as an expected benefit until measured.

---

## 3. Scope: What to Build in Under Six Hours

### P0 — Must work

- Household and vendor views.
- Create a scrap pickup request.
- Display scrap types and indicative prices per kilogram.
- Save requests to SQL.
- Display open requests in a vendor feed.
- Sort/filter requests by distance when coordinates are available.
- Claim a request with server-side protection against duplicate claims.
- Update pickup status.
- Refresh the page and retain saved data.
- Deploy a usable public application on AWS, subject to the hackathon's permitted workflow.

### P1 — Add only after P0 works

- Approximate pickup location before assignment.
- Exact pickup details available only to the assigned vendor, if appropriate.
- A simple pickup confirmation or final-weight entry.
- Clear loading, empty, and error states.
- A small transaction history.

### P2 — Do not prioritize in the first build

- Complex multi-stop route optimization.
- Real-time maps and live GPS tracking.
- Payments or escrow.
- Full identity verification.
- Chat, reviews, notifications, or elaborate analytics.
- Microservices or AI features that do not improve the core demo.

**Rule:** No new feature should jeopardize the end-to-end flow or deployment.

---

## 4. Recommended Architecture

### Logical architecture

```text
                   ┌────────────────────────────┐
                   │  Household / Vendor        │
                   │  Mobile browser            │
                   └──────────────┬─────────────┘
                                  │ HTTPS
                                  ▼
                   ┌────────────────────────────┐
                   │ Next.js + TypeScript       │
                   │ Household and vendor UI    │
                   │ AWS Amplify Hosting        │
                   └──────────────┬─────────────┘
                                  │ HTTPS API
                                  ▼
                   ┌────────────────────────────┐
                   │ Python FastAPI             │
                   │ Validation and API logic   │
                   │ Matching and state changes │
                   │ AWS App Runner if permitted│
                   └──────────────┬─────────────┘
                                  │ SQL
                                  ▼
                   ┌────────────────────────────┐
                   │ SQL database               │
                   │ PostgreSQL preferred       │
                   │ Amazon RDS if practical    │
                   └────────────────────────────┘
```

### Proposed AWS services

| Layer | Preferred option | Notes |
|---|---|---|
| Web frontend | AWS Amplify Hosting | Connect a Git repository and deploy a supported Next.js app. |
| Python API | AWS App Runner, if available and permitted | Can run a container or supported source deployment. Confirm account access, region availability, and cost first. |
| SQL database | Existing PostgreSQL or Amazon RDS for PostgreSQL | Use RDS only if provisioning and networking can be completed quickly. |
| Secrets | Environment variables for non-secret configuration; AWS Secrets Manager or the platform's supported secret configuration for credentials | Never commit passwords, API keys, or AWS credentials to Git. |
| Logs | Hosting/platform logs and application logs | Check these immediately when deployment or API calls fail. |
| Repository | GitHub or organizer-provided repository | Confirm the rules before choosing the source workflow. |

### Important deployment fallback

The exact AWS Builder Center experience and credit eligibility are not yet confirmed. Builder Center may be the hackathon/project/submission portal rather than the actual coding or deployment environment. First inspect the hackathon rules and any required coding-agent setup.

Do not assume AWS credits cover every service. Verify the account, active region, credit eligibility, and budget before provisioning paid resources.

If the AWS services above are unavailable, choose the simplest permitted AWS deployment path. Do not spend a large part of the hackathon on VPC networking or infrastructure configuration.

### Database decision

1. Use an existing PostgreSQL database if one is already available and accessible.
2. Use RDS PostgreSQL if account access, networking, and setup are straightforward.
3. SQLite can be used for local development or a constrained prototype, but do **not** rely on a temporary container filesystem for durable production data. Confirm persistence behavior before using it in a deployed demo.

Do not claim the deployed application has durable SQL persistence until you have tested it.

---

## 5. Core User Journeys

### Household

1. Open the household view.
2. Select a scrap category (e.g., newspaper, cardboard, plastic, or metal).
3. Enter an estimated quantity in kilograms.
4. Review the indicative rate and estimated value.
5. Enter or select a location.
6. Submit the pickup request.
7. See its status and assigned vendor when claimed.
8. Confirm collection/completion if the workflow requires household confirmation.

### Vendor

1. Open the vendor view.
2. See open pickup requests.
3. Compare category, quantity, indicative value, and distance.
4. Claim a request.
5. View the pickup details needed for collection.
6. Mark it picked up and then completed.
7. See the updated status in the request/transaction history.

### Demo scenario

Use two browser sessions or separate role views:

- Session A creates a 5 kg newspaper request.
- Session B sees the request in the vendor feed.
- Session B claims it.
- Verify the request disappears from the open feed or shows as claimed.
- Attempt a second claim from another vendor/session and verify it fails.
- Update the request to `PICKED_UP`, then `COMPLETED`.
- Refresh both sessions and verify the persisted status.

All seeded prices and quantities are demo data. Label prices as indicative; actual settlement depends on final weight and material quality.

---

## 6. Data Model

### `users`

| Field | Type / purpose |
|---|---|
| `id` | Primary key |
| `name` | Display name |
| `role` | `HOUSEHOLD` or `VENDOR` |
| `latitude` | Nullable coordinate |
| `longitude` | Nullable coordinate |
| `created_at` | Creation timestamp |

### `scrap_rates`

| Field | Type / purpose |
|---|---|
| `id` | Primary key |
| `scrap_type` | Category |
| `rate_per_kg` | Indicative rate |
| `currency` | e.g., `INR` |
| `effective_from` | Date/time the rate became effective |
| `is_active` | Whether the rate is currently displayed |

### `scrap_requests`

| Field | Type / purpose |
|---|---|
| `id` | Primary key |
| `household_id` | Foreign key to `users` |
| `vendor_id` | Nullable foreign key to `users` |
| `scrap_type` | Category |
| `quantity_kg` | Household's estimated quantity |
| `rate_per_kg` | Indicative rate snapshot at request creation |
| `estimated_value` | `quantity_kg × rate_per_kg` |
| `latitude` / `longitude` | Pickup coordinates, subject to privacy rules |
| `status` | Request lifecycle state |
| `created_at` / `updated_at` | Timestamps |

### `transactions`

| Field | Type / purpose |
|---|---|
| `id` | Primary key |
| `request_id` | Unique foreign key to completed request, where appropriate |
| `final_weight_kg` | Actual measured weight |
| `final_rate_per_kg` | Agreed final rate |
| `final_amount` | Final settlement amount |
| `completed_at` | Completion timestamp |

For the minimum demo, `transactions` can be deferred if time is very tight, but request status and the estimated price should persist in SQL.

### Request status lifecycle

```text
OPEN ──claim──> CLAIMED ──pickup──> PICKED_UP ──complete──> COMPLETED
  │
  └──cancel──> CANCELLED
```

Only valid transitions should be accepted by the backend. The household/vendor role must be checked for each action.

---

## 7. API Contract

Agree on these endpoints before frontend and backend work diverge.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Check API availability |
| `GET` | `/api/rates` | Get active indicative rates |
| `POST` | `/api/requests` | Create a household pickup request |
| `GET` | `/api/requests/nearby?lat=...&lng=...` | Return open requests sorted/filtered by distance |
| `GET` | `/api/requests/{id}` | Get request details |
| `POST` | `/api/requests/{id}/claim` | Claim a request |
| `PATCH` | `/api/requests/{id}/status` | Advance request status |

### Example create-request payload

```json
{
  "scrap_type": "newspaper",
  "quantity_kg": 5,
  "latitude": 28.6139,
  "longitude": 77.209
}
```

### Example response

```json
{
  "id": 101,
  "scrap_type": "newspaper",
  "quantity_kg": 5,
  "rate_per_kg": 15,
  "estimated_value": 75,
  "status": "OPEN",
  "distance_km": 1.4
}
```

The coordinates and rates above are illustrative demo data, not verified market data. Do not hardcode a distance in a response; calculate it from the request and vendor coordinates.

### Claiming must be atomic

Do not prevent double claiming only by disabling a frontend button. Use a conditional database update or transaction that succeeds only if the request is still `OPEN`. If another vendor has claimed it first, return a conflict response such as HTTP `409 Conflict`.

For a demo without full authentication, use explicit demo identities/roles and label the limitation. Do not treat a role supplied by an untrusted browser as secure authentication in a production system.

---

## 8. Location Matching

For the MVP:

1. Store latitude and longitude for each request and vendor.
2. Calculate approximate distance using the Haversine formula or an appropriate geospatial database query.
3. Filter by a simple radius, such as a configurable 3–5 km demo radius.
4. Sort nearest requests first.
5. Clearly handle missing coordinates.

A route sorted by distance is **not** a fully optimized multi-stop route. Multi-stop routing is a stretch goal only after the end-to-end workflow works.

### Privacy

- Avoid exposing a household's precise coordinates to every vendor browsing the feed.
- Show approximate distance/location before claim when possible.
- Reveal the precise pickup address/location only to the assigned vendor when appropriate.
- Use demo coordinates and identities during public presentations.

---

## 9. Frontend Pages

Keep the application to a few useful screens:

1. **Landing / role selection:** Household or vendor demo view.
2. **Household request page:** Scrap type, quantity, indicative rate, location, estimated value, submit button.
3. **Household status page:** Current requests and pickup status.
4. **Vendor feed:** Open requests, distance, quantity, estimated value, claim button.
5. **Vendor pickup details:** Assigned request and allowed status transitions.

### UI priorities

- Mobile-first layout.
- Clear primary actions.
- Readable indicative pricing.
- Visible status labels.
- Loading, error, and empty states.
- No dead buttons.
- No decorative map that does not use actual request coordinates.

A basic list with distance labels is better than a broken map.

---

## 10. Six-Hour Execution Schedule

The following is a target plan, not a guarantee. If time has already elapsed, preserve the order and compress optional work.

### 0–20 minutes: Verify and freeze scope

- Check hackathon rules and required AWS tools.
- Verify account/region and credit information.
- Confirm repository and who has access.
- Agree on the API contract and status states.
- Create the minimal frontend and backend skeletons.

**Deliverable:** both team members can work independently.

### 20–90 minutes: Parallel foundation

**Person A — Frontend**
- Create role selection, household form, and vendor feed.
- Add sample loading/error/empty states.
- Use a configurable API base URL.

**Person B — Backend**
- Create FastAPI app and `/health`.
- Create SQL schema.
- Seed a few users, requests, and clearly indicative rates.
- Implement create-request and list-open-requests endpoints.

**Deliverable:** running UI and API with seed data.

### 90–180 minutes: End-to-end functionality

- Connect the frontend to the API.
- Implement distance calculations and nearby feed.
- Implement atomic claiming.
- Implement status updates.
- Verify records persist after refresh.

**Deliverable:** household → vendor → completed pickup works.

### 180–240 minutes: Deploy and integrate

- Push working code to the repository.
- Deploy Next.js using the permitted AWS hosting path.
- Deploy FastAPI using the permitted AWS runtime.
- Configure the frontend API URL and backend CORS.
- Connect SQL storage and verify actual persistence.
- Check public URLs from a separate browser/session.

**Deliverable:** deployed application with the main flow working.

### 240–300 minutes: Test, polish, and rehearse

- Test duplicate claims.
- Test invalid quantity, missing fields, and unavailable requests.
- Test refresh and status persistence.
- Fix critical errors only.
- Prepare demo data and rehearse the pitch.

**Deliverable:** stable live demo.

### Final 30–60 minutes: Contingency and submission

- Avoid adding new features.
- Record a short backup demo if permitted.
- Verify the public URL and repository permissions.
- Complete the Builder Center project/submission form.
- Confirm that the submission has actually been saved/published.

---

## 11. Team Responsibilities

### Person A — Next.js and frontend deployment

- Household and vendor views.
- Request form and indicative rate display.
- Vendor feed and claim interaction.
- API integration and mobile styling.
- Frontend deployment and public URL validation.

### Person B — FastAPI, SQL, and backend deployment

- SQL models and seed data.
- Request creation and nearby feed.
- Distance matching.
- Atomic claim and status transitions.
- Backend deployment, database connection, and logs.

### Shared responsibilities

- Agree on API request/response shapes.
- Test the full workflow together.
- Prepare realistic demo data.
- Rehearse and submit the project.

If one person is substantially stronger at backend development, assign that person the backend. Prioritize execution speed rather than titles.

---

## 12. Testing Checklist

- [ ] `/health` returns success from the deployed API.
- [ ] A household can create a request.
- [ ] Invalid quantities are rejected.
- [ ] The request is saved in SQL.
- [ ] The request appears in the vendor feed.
- [ ] Distance is calculated rather than hardcoded.
- [ ] A vendor can claim an open request.
- [ ] A second claim fails reliably.
- [ ] Invalid status transitions are rejected.
- [ ] Completed status persists after refresh.
- [ ] Frontend CORS and API URL are correct.
- [ ] The public frontend and backend work from a separate session.
- [ ] No secrets are committed to the repository.
- [ ] Demo prices are clearly labelled indicative.
- [ ] The submission URL and repository are accessible to judges.

---

## 13. Demo and Pitch

### Suggested 60–90 second demonstration

1. State the problem: households cannot reliably arrange scrap collection, while vendors waste time searching for inventory.
2. Create a household request for a few kilograms of newspaper.
3. Switch to the vendor view and show the request appearing nearby.
4. Claim the request.
5. Show that another vendor cannot claim it.
6. Update the pickup status and refresh the page.
7. Explain the architecture: Next.js frontend, FastAPI matching/business logic, SQL persistence, and AWS deployment.
8. State the expected benefits—better coordination and potentially fewer wasted trips—as hypotheses to validate, not measured results.

### Claims to avoid

Do not claim that:
- Routes are fully optimized if requests are merely sorted by distance.
- Prices are live market rates if they are seeded demo values.
- The app is production-secure if it uses demo identities.
- Data is durable if the deployed database/storage has not been tested.
- Environmental impact has been measured without evidence.

---

## 14. Risks and Contingencies

| Risk | Response |
|---|---|
| AWS account lacks permission for a service | Use a permitted alternative; do not spend hours requesting complex infrastructure changes. |
| Credits are unclear | Check account billing/credits and service eligibility before provisioning. |
| Database networking takes too long | Finish the application workflow locally/test-backed first; simplify infrastructure without claiming unverified persistence. |
| Frontend and backend integration fails | Use the agreed API contract and test `/health` first. |
| Full map integration fails | Use calculated distances in a sorted list. |
| Time runs short | Drop route optimization, auth, and extras; preserve request → claim → completion. |
| Public deployment fails | Capture logs, fix the smallest blocking issue, and retain a permitted local/recorded backup demo. |

---

## 15. Immediate Next Actions

1. Open the exact hackathon page in AWS Builder Center and verify its rules.
2. Determine whether organizers require a particular AWS coding agent or connected workflow.
3. Verify the AWS account, active region, credit eligibility, repository, and available deployment permissions.
4. Assign Person A to frontend and Person B to backend.
5. Freeze the API contract.
6. Get `/health` and the basic frontend running.
7. Build the core transaction before any stretch feature.
8. Deploy early, verify the live workflow, and submit before the deadline.

### Final priority

**A small, working, AWS-deployed KabaadLink with one reliable transaction is the target.** A complex architecture with unfinished integration is not.

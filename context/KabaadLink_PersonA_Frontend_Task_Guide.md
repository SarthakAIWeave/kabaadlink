# KabaadLink — Person A (Frontend & UI/UX Lead) Task Guide

**Project:** KabaadLink — Hyperlocal Scrap Pickup Marketplace  
**Your Role:** Person A (Frontend Engineer, UI/UX Lead, Amplify Hosting Lead)  
**Teammate Role:** Person B (Backend Engineer, Database & Cloud Infrastructure Lead)  
**Time Constraint:** < 6 Hours (Hackathon Execution)  
**Your Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, AWS Amplify Hosting  

---

## 1. Whole Project Context & Architecture Overview

### 1.1 Project Purpose & Solution
KabaadLink is a hyperlocal scrap pickup marketplace connecting households with nearby scrap vendors (*kabadiwalas*):
- **Households:** Publish scrap requests (material category, estimated weight, location, address notes) and view indicative rate calculations.
- **Vendors:** View open requests sorted nearest-first, claim a pickup atomically, and update pickup status to completed upon collection.
- **Core Hackathon Target:** Deliver **one working, deployed end-to-end transaction** on AWS:
  $$\text{Household Create Request} \longrightarrow \text{Vendor Feed} \longrightarrow \text{Atomic Claim (409 on race)} \longrightarrow \text{Picked Up} \longrightarrow \text{Completed}$$

### 1.2 Logical System Architecture

```text
  📱 Phone / Laptop Browser (Household or Vendor View)
                 │  HTTPS
                 ▼
  ┌───────────────────────────────┐
  │ AWS Amplify Hosting           │  Next.js 15 (App Router, Client-side Fetching)
  │ (YOUR RESPONSIBILITY)         │  Env: NEXT_PUBLIC_API_BASE_URL
  └───────────────┬───────────────┘
                  │  HTTPS API Calls (Header: X-Demo-User-Id)
                  ▼
  ┌───────────────────────────────┐
  │ AWS ECS Express Mode Service  │  Python FastAPI Container (Port 8000)
  │ (Person B Responsibility)     │  Endpoints: /health, /ping, /api/*
  └───────────────┬───────────────┘
                  │  PostgreSQL Protocol
                  ▼
  ┌───────────────────────────────┐
  │ Amazon RDS PostgreSQL         │  Database: kabaadlink
  │ (Person B Responsibility)     │  Tables: users, scrap_rates, scrap_requests
  └───────────────────────────────┘
```

---

## 2. API Contract & Communication Specification

### 2.1 Demo User Header Protocol
All API calls sent from the frontend to `/api/*` (except public endpoints like `/api/rates` and `/api/demo/users`) MUST include the header:
```http
X-Demo-User-Id: <user_id>
```
The backend uses this header to identify the user and enforce their role (`HOUSEHOLD` or `VENDOR`).

### 2.2 Status Lifecycle & Allowed User Actions

```text
                 ┌── release (assigned vendor) ──┐
                 ▼                               │
 OPEN ── claim (vendor) ──▶ CLAIMED ── pickup (assigned vendor) ──▶ PICKED_UP ── complete (assigned vendor, final weight) ──▶ COMPLETED
  │                           │
  └── cancel (owner) ─────────┴── cancel (owner) ──▶ CANCELLED
```

---

## 3. Your Specific Tasks & Deliverables (Person A)

You own the **entire `frontend/` directory, UI/UX screens, API client integration, AWS Amplify deployment, pitch script, and submission materials**.

### Directory Structure to Build:
```text
frontend/
  app/
    layout.tsx
    page.tsx                      # Landing & Demo User Selector
    household/
      new/page.tsx                # Create Pickup Request Form
      requests/page.tsx           # Household "My Requests" Status List
    vendor/
      feed/page.tsx               # Vendor Nearby Feed + Claim Action
      pickups/page.tsx            # Vendor "My Pickups" + Status Transitions
    requests/[id]/page.tsx        # Request Detail View & History Timeline
  components/
    Navbar.tsx                    # Top navigation with current user indicator
    DemoUserPicker.tsx            # Household / Vendor switch context
    RequestCard.tsx               # Request summary card component
    StatusBadge.tsx               # Status badge (OPEN, CLAIMED, PICKED_UP, COMPLETED, CANCELLED)
    LocationPicker.tsx            # Geolocation button + Preset location dropdown
    ErrorBanner.tsx               # Toast/Alert for errors (e.g. HTTP 409 Conflict)
  lib/
    api.ts                        # Centralized fetch client with header injection & mock fallback
    demoUser.tsx                  # React Context storing active demo user
    types.ts                      # TypeScript models for Rate, RequestSummary, RequestDetail
    format.ts                     # Currency & IST date formatters
  .env.example                    # NEXT_PUBLIC_API_BASE_URL=
  amplify.yml                     # Build configuration for AWS Amplify
```

---

### 3.1 Page Specifications & Features

#### 1. Landing & Role Selection (`/`)
- Calls `GET /api/demo/users`.
- Displays selectable user cards grouped by role:
  - **Households:** Household A (Default), Household B.
  - **Vendors:** Vendor 1, Vendor 2, Vendor 3.
- Selecting a user updates `DemoUserContext` and persists the selection in `localStorage`.
- Provides quick-jump buttons to Household View or Vendor View.

#### 2. Household Create Request (`/household/new`)
- Calls `GET /api/rates` on load to fetch active rates (e.g. Newspaper ₹15/kg, Cardboard ₹8/kg, Plastic ₹10/kg).
- Form fields:
  - Scrap category dropdown.
  - Estimated weight (`quantity_kg`, validated 0.1 to 500 kg).
  - Dynamic **Indicative Rate & Total Calculation**:
    $$\text{Estimated Total} = \text{quantity\_kg} \times \text{rate\_per\_kg}$$
    *(Must feature a clear "Indicative Rate" disclaimer tag).*
  - Location selection (`LocationPicker` component): Browser geolocation button **PLUS** a preset location dropdown (e.g., "Connaught Place", "Saket", "Dwarka") so testing never fails if GPS is blocked.
  - Address notes / landmarks textarea.
- Submit button calls `POST /api/requests`. Disables during loading. On success, redirects to `/household/requests`.

#### 3. Household My Requests (`/household/requests`)
- Calls `GET /api/requests/mine` with `X-Demo-User-Id`.
- Displays cards for all created requests with real-time status badges (`OPEN`, `CLAIMED`, `PICKED_UP`, `COMPLETED`).
- If status is `CLAIMED`, displays the assigned vendor's name.
- Allows household to cancel open/claimed requests via `POST /api/requests/{id}/cancel`.

#### 4. Vendor Nearby Feed (`/vendor/feed`)
- Geolocation / preset selector for vendor position (`lat`, `lng`).
- Radius filter dropdown (3 km, 5 km [default], 10 km).
- Calls `GET /api/requests/nearby?lat=...&lng=...&radius_km=...`.
- Displays request summary cards sorted nearest-first:
  - Material, weight, indicative estimate, rounded distance (e.g., "1.4 km away").
  - Approximate coordinates (never exact address before claim).
- **Claim Action Button:**
  - Calls `POST /api/requests/{id}/claim`.
  - Disables button while request is in flight to prevent duplicate submissions.
  - **`HTTP 409 Conflict` Handling:** If claimed by another vendor, displays a high-visibility toast/banner: `"This request was just claimed by another vendor."` and automatically refetches the feed.

#### 5. Vendor My Pickups (`/vendor/pickups`)
- Calls `GET /api/requests/mine` (vendor role).
- Displays assigned claimed/active pickups.
- Action Buttons per item:
  - **Mark Picked Up:** Calls `POST /api/requests/{id}/pickup` (`CLAIMED` $\rightarrow$ `PICKED_UP`).
  - **Complete Pickup:** Opens a modal asking for `final_weight_kg`. Calls `POST /api/requests/{id}/complete` with payload `{"final_weight_kg": 4.6}`. Displays final calculated settlement amount.
  - **Release:** Calls `POST /api/requests/{id}/release` (`CLAIMED` $\rightarrow$ `OPEN`).

---

### 3.2 Mock Mode Setup (`lib/api.ts`)

Enable mock mode so you can build and test all UI screens before Person B finishes deploying the backend API:

```typescript
// lib/api.ts snippet
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (USE_MOCK) {
    return getMockData<T>(endpoint);
  }
  
  const demoUserId = localStorage.getItem("kabaad_demo_user_id") || "1";
  const headers = {
    "Content-Type": "application/json",
    "X-Demo-User-Id": demoUserId,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  
  if (response.status === 409) {
    const errData = await response.json();
    throw new Error(errData.error?.message || "Conflict: Request already claimed");
  }
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}
```

---

### 3.3 AWS Amplify Deployment Runbook

1. Connect your GitHub repository in the **AWS Amplify Console**.
2. Set Monorepo App Root: Set **`frontend`** as the monorepo directory.
3. Configure Environment Variables in Amplify:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://<person_b_ecs_api_url>` (Use temporary placeholder until Person B provides final API URL at Gate G1).
   - `AMPLIFY_MONOREPO_APP_ROOT` = `frontend`
4. Add `frontend/amplify.yml`:
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
5. Pin Node runtime to Node **20** or **22** in build settings.

---

### 3.4 Presentation Pitch & Demo Script (90 Seconds)

You own the hackathon demo walk-through:

1. **The Problem (15s):** Households lack transparent scrap pricing and reliable collection; vendors waste fuel wandering without knowing where scrap exists.
2. **Household Creation (20s):** Show Household A selecting 5 kg newspaper on laptop $\rightarrow$ display indicative estimate (₹75.00) $\rightarrow$ submit request.
3. **Vendor Feed (20s):** Switch to mobile view on Vendor 1 device $\rightarrow$ show request appearing with distance label "1.4 km away" $\rightarrow$ click **Claim**.
4. **Race Condition Test (15s):** On a secondary browser (Vendor 2), attempt to claim the same request $\rightarrow$ show the **HTTP 409 "Taken by another vendor"** alert.
5. **Completion (10s):** Vendor 1 marks `Picked Up` $\rightarrow$ inputs final weight (4.6 kg) $\rightarrow$ status becomes `Completed` $\rightarrow$ refresh page to prove PostgreSQL persistence.
6. **Architecture & Close (10s):** Summary of stack (Next.js 15 on Amplify + FastAPI on ECS Express + PostgreSQL on RDS). Note demo-identity limitation.

---

## 4. Synchronized 6-Hour Timeline & Milestones

| Phase & Time | Person A (Your Tasks) | Person B (Teammate Tasks) | Joint Sync Gate |
|---|---|---|---|
| **Phase 0 (T+0 $\rightarrow$ T+25m)** | Setup Next.js 15 repo structure, Tailwind, TypeScript types, mock JSON files. | Start RDS creation, ECR repo setup, budget alert. | **Gate G0:** Freeze API contract in `contract/examples/*.json`. |
| **Phase 1 (T+25m $\rightarrow$ T+100m)** | Build all UI pages against mock mode (`NEXT_PUBLIC_USE_MOCK=true`). Connect AWS Amplify and deploy skeleton at T+60. | Build FastAPI endpoints locally, Docker containerize, deploy ECS Express service. | **Gate G1 (Walking Skeleton):** Deployed Amplify UI calls deployed API `/health` & `/api/demo/users` over HTTPS. |
| **Phase 2 (T+100m $\rightarrow$ T+190m)** | Switch `api.ts` to real API URL. Wire Claim button with 409 Conflict handling. Build Pickup/Complete modals. | Implement atomic `claim` logic in SQL, nearby Haversine search, race test. | **Gate G2:** Complete end-to-end loop (Create $\rightarrow$ Feed $\rightarrow$ Claim $\rightarrow$ Complete) working live on AWS. |
| **Phase 3 (T+190m $\rightarrow$ T+270m)** | Mobile UI polish, empty states, IST timestamps, finalize pitch script & demo dataset. | Database persistence test, CORS verification, CloudWatch log review. | **Gate G3 (Feature Freeze):** All P0 items passing. Zero new code changes. |
| **Phase 4 (T+270m $\rightarrow$ T+330m)** | Rehearse 90s pitch twice. Record backup demo video. Submit on hackathon portal. | Assist in demo dry-run & backup video recording. | Final submission saved & verified. |

---

## 5. Person A Checklist

- [ ] Next.js 15 app builds locally with zero TypeScript errors (`npm run build`).
- [ ] User role switcher updates `DemoUserContext` and injects `X-Demo-User-Id`.
- [ ] Rate card displays indicative price disclaimers on request creation.
- [ ] LocationPicker provides both browser GPS and preset locations.
- [ ] Vendor feed displays distance labels and hides exact address details before claim.
- [ ] Claim button disables on click and handles `HTTP 409 Conflict` gracefully with a clear banner message.
- [ ] Complete modal accepts `final_weight_kg` and displays calculated final settlement.
- [ ] Deployed AWS Amplify URL loads cleanly on mobile devices without CORS errors.
- [ ] Demo pitch rehearsed within 90 seconds.

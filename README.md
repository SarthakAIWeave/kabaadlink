# KabaadLink — Hyperlocal Scrap Pickup Marketplace

**Project:** KabaadLink  
**Purpose:** A localized marketplace connecting households with scrap vendors (*kabadiwalas*) to make scrap collection reliable, transparent, and efficient.  
**Stack:** Next.js 15 (Frontend) | Python FastAPI (Backend) | PostgreSQL (Database) | AWS (Amplify, ECS Express Mode, ECR, RDS)  

---

## 📌 Repository Overview & Architecture Index

This repository contains the complete architecture specifications, system context, API contracts, data models, and team execution guides for building KabaadLink:

| Document | Purpose | Target Audience |
|---|---|---|
| [**`the main architecture.md`**](./the%20main%20architecture.md) | Refined master architecture document, system design, data models, deployment runbook, & risk analysis | Whole Team / Lead Architect |
| [**`KabaadLink_Hackathon_Context_and_Architecture.md`**](./KabaadLink_Hackathon_Context_and_Architecture.md) | Original context & baseline architecture specification | Whole Team |
| [**`KabaadLink_PersonA_Frontend_Task_Guide.md`**](./KabaadLink_PersonA_Frontend_Task_Guide.md) | Step-by-step frontend task specification, UI screens, API client integration, mock mode setup, & AWS Amplify runbook | Person A (Frontend Lead) |
| [**`KabaadLink_PersonB_Backend_Task_Guide.md`**](./KabaadLink_PersonB_Backend_Task_Guide.md) | Step-by-step backend task specification, PostgreSQL models, atomic claim SQL logic, Haversine distance matching, & AWS ECS/RDS runbook | Person B (Backend Lead) |
| [**`KabaadLink_Teammate_Backend_Task_Guide.md`**](./KabaadLink_Teammate_Backend_Task_Guide.md) | Full teammate execution reference guide | Teammate Reference |

---

## 🚀 Key System Features & Core Transaction Flow

1. **Household Request Creation:** Households create a scrap request specifying category, weight estimate, location, and address notes. System displays transparent indicative price calculations.
2. **Vendor Nearby Feed:** Nearby vendors view open requests within a radius (default 5 km), sorted nearest-first with approximate location privacy protection.
3. **Atomic Claiming:** Prevents double-claiming at the database level using conditional updates (`WHERE status = 'OPEN'`). Concurrent claims return `HTTP 409 Conflict`.
4. **Pickup & Completion:** Vendors update pickup status (`CLAIMED` $\rightarrow$ `PICKED_UP` $\rightarrow$ `COMPLETED`) with final weight entry and settlement calculations.

---

## 🏗️ Architecture Flow

```text
  📱 Mobile / Desktop Client (Household or Vendor View)
                 │  HTTPS
                 ▼
  ┌───────────────────────────────┐
  │ AWS Amplify Hosting           │  Next.js 15 (App Router, Client-side Fetching)
  │ (Frontend UI)                 │  Env: NEXT_PUBLIC_API_BASE_URL
  └───────────────┬───────────────┘
                  │  HTTPS API Calls (Header: X-Demo-User-Id)
                  ▼
  ┌───────────────────────────────┐
  │ AWS ECS Express Mode Service  │  Python FastAPI Container (Port 8000)
  │ (Backend API Container)       │  Endpoints: /health, /ping, /api/*
  └───────────────┬───────────────┘
                  │  PostgreSQL Protocol (Port 5432)
                  ▼
  ┌───────────────────────────────┐
  │ Amazon RDS PostgreSQL         │  Database: kabaadlink
  │ (Database Layer)              │  Tables: users, scrap_rates, scrap_requests
  └───────────────┴───────────────┘
```

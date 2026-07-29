# ParceFlyte

ParceFlyte is a peer-to-peer parcel delivery platform that connects senders with travelers (carriers) who have spare luggage capacity along a route they are already taking. The platform handles carrier discovery, multi-factor match scoring, fee negotiation, escrowed payment, two-sided ratings, and a KYC/compliance layer with an admin review workflow.

> **Project status:** pre-alpha. The data layer, matching engine, and the parcel/travel/match/payment/rating APIs are implemented. The KYC subsystem currently exists as UI components plus a schema — its API routes are not yet built. See [Implementation status](#implementation-status) for the exact gap list before running the app.

---

## Table of contents

- [Domain model](#domain-model)
- [System architecture](#system-architecture)
- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Matching engine](#matching-engine)
- [Negotiation flow](#negotiation-flow)
- [Payments and escrow](#payments-and-escrow)
- [KYC and compliance subsystem](#kyc-and-compliance-subsystem)
- [Authentication and authorization](#authentication-and-authorization)
- [Frontend architecture](#frontend-architecture)
- [Getting started](#getting-started)
- [Implementation status](#implementation-status)
- [Roadmap](#roadmap)
- [License](#license)

---

## Domain model

Five core entities drive the whole system:

| Entity | Meaning |
| --- | --- |
| **User** | An account. Holds Auth0 identity, profile, roles (`sender` / `carrier` / `admin`), KYC status, payment methods, and an aggregate rating. |
| **Travel** | A trip a carrier is taking — origin, destination, dates, transport mode, available weight/volume capacity, and a base delivery fee. |
| **Parcel** | A package a sender wants delivered — dimensions, weight, declared value, category, special handling needs, recipient, and delivery deadline. |
| **Match** | A proposed pairing of one parcel with one travel. Carries the match score, the negotiation thread, the agreed terms, and the accept/reject state. |
| **Payment** | Money held in escrow against an accepted match, released on delivery confirmation or refunded on dispute. |

Supporting entities: **Rating** (two-sided post-delivery reviews) and **KYC** (identity verification, risk scoring, and compliance screening records).

The happy path:

```
sender posts Parcel ─┐
                     ├─► Matching engine scores candidate pairs ─► Match (proposed)
carrier posts Travel ┘                                                  │
                                                                        ▼
                                                    negotiate fee (back-and-forth)
                                                                        │
                                                                        ▼
                                              accept ─► Payment funded into escrow
                                                                        │
                                                                        ▼
                                            pickup → in_transit → delivered
                                                                        │
                                                                        ▼
                                       escrow released ─► both parties rate each other
```

---

## System architecture

ParceFlyte is a single Next.js 14 App Router application. There is no separate backend service — API routes and React pages are deployed as one unit, talking directly to MongoDB via the native driver.

```
┌───────────────────────────────────────────────────────────────────┐
│  Browser                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │ Marketing    │  │ Dashboard    │  │ Admin (KYC review)     │   │
│  │ (/)          │  │ (/dashboard) │  │ (/admin/kyc)           │   │
│  └──────────────┘  └──────────────┘  └────────────────────────┘   │
│         React 18 client components · Tailwind · Radix UI          │
└──────────────────────────────┬────────────────────────────────────┘
                               │ fetch() with Auth0 session cookie
┌──────────────────────────────▼────────────────────────────────────┐
│  Next.js App Router (src/app)                                     │
│                                                                   │
│  /api/auth/[auth0] ──── handleAuth() ──► Auth0 tenant             │
│                                                                   │
│  Every other route is wrapped in withApiAuthRequired() and pulls  │
│  a scoped access token via getAccessToken({ scopes: [...] })      │
│                                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ /api/users  │ │ /api/travels│ │ /api/    │ │ /api/matches   │  │
│  │ /api/parcels│ │ /api/flights│ │ payments │ │  └ accept      │  │
│  │ /api/ratings│ │ /api/search │ │          │ │  └ reject      │  │
│  └─────────────┘ └─────────────┘ └──────────┘ │  └ negotiate   │  │
│                                               └────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ /api/matching  ·  /api/matching/auto                         │ │
│  └───────────────────────────┬──────────────────────────────────┘ │
└──────────────────────────────┼────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────┐
│  src/lib/matching-service.js — weighted scoring engine (singleton)│
└──────────────────────────────┬────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────┐
│  src/lib/db.js — cached MongoClient promise (HMR-safe in dev)     │
└──────────────────────────────┬────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────┐
│  MongoDB — database `parceflyte`                                  │
│  collections: users · travels · parcels · matches ·               │
│               payments · ratings · (kyc)                          │
└───────────────────────────────────────────────────────────────────┘
```

### Key architectural decisions

**MongoDB native driver, not an ODM.** [`src/lib/db.js`](parceflyte-v1/src/lib/db.js) exports a module-scoped `MongoClient` promise. In development it stashes the promise on `global._mongoClientPromise` so Hot Module Replacement doesn't open a new connection pool on every edit; in production it connects once per process. The driver returns plain documents, so there is no model layer between the routes and the database.

**Schemas are documentation, not enforcement.** Everything in [`src/models/schemas/`](parceflyte-v1/src/models/schemas/) is a plain JavaScript object literal describing field types, enums, and defaults. Nothing validates against them at runtime — API routes do their own inline required-field checks. They are the reference for what a document should look like, and the place to change first when the shape evolves.

**Matching is a stateless service singleton.** [`src/lib/matching-service.js`](parceflyte-v1/src/lib/matching-service.js) exports one instantiated `MatchingService`. It holds only the scoring weights as state; every method takes the documents it needs as arguments or reads them fresh. That keeps it trivially testable and safe to share across concurrent requests.

**Authorization is scope-based, delegated to Auth0.** No route reads a role off the user document to gate access. Each handler asks Auth0 for an access token carrying a specific scope (`read:parcels`, `write:matches`, …); if the token can't be issued, the request fails. Roles on the user document are for display and business logic, not access control.

---

## Repository layout

```
ParceFlyte/
├── README.md                       ← this file (the only doc in the repo)
└── parceflyte-v1/                  ← the Next.js application
    ├── next.config.mjs             ← ESLint errors ignored during builds
    ├── package.json
    ├── public/
    │   └── logo.png
    └── src/
        ├── app/                    ← App Router: pages + API routes
        │   ├── layout.js           ← root layout, fonts, globals.css
        │   ├── page.js             ← marketing home page
        │   ├── globals.css         ← Tailwind directives + CSS custom properties
        │   ├── (auth)/             ← route group, no URL segment
        │   │   ├── login/          ← /login
        │   │   └── register/       ← /register
        │   ├── dashboard/          ← /dashboard — carrier/sender workspace
        │   ├── admin/kyc/          ← /admin/kyc — KYC review queue
        │   ├── kyc-test/           ← /kyc-test — demo harness (remove for prod)
        │   ├── test-negotiation/   ← /test-negotiation — demo harness (remove for prod)
        │   └── api/                ← all backend endpoints (see API reference)
        │
        ├── components/
        │   ├── ui/                 ← shadcn/ui primitives over Radix
        │   ├── home/               ← navbar, hero, hero-cards, about, features
        │   ├── auth-form.js        ← shared login/register form
        │   ├── match-details-card.jsx      ← per-factor match score breakdown
        │   ├── match-negotiation-modal.jsx ← fee negotiation UI (largest component)
        │   ├── kyc-onboarding-form.jsx     ← KYC entry point
        │   ├── kyc-stepper-modal.jsx       ← multi-step KYC wizard
        │   └── admin-kyc-review-modal.jsx  ← admin approve/reject UI
        │
        ├── lib/
        │   ├── db.js               ← MongoClient singleton
        │   ├── matching-service.js ← scoring engine
        │   └── utils.js            ← cn() — clsx + tailwind-merge
        │
        ├── models/schemas/         ← document shape definitions
        │   ├── user.js  parcel.js  travel.js  match.js
        │   ├── payment.js  rating.js  kyc.js
        │   └── flight.js           ← unused mongoose stub (see status section)
        │
        └── assets/images/
```

**Path alias:** imports use `@/` for `src/` (e.g. `@/lib/db`, `@/components/ui/button`). This alias requires a `jsconfig.json` that is **not currently in the repo** — see [Implementation status](#implementation-status).

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router), React 18 |
| Language | JavaScript (no TypeScript) |
| Database | MongoDB 6.x via the official `mongodb` native driver |
| Auth | Auth0 (`@auth0/nextjs-auth0` v3) — scope-based access control |
| Styling | Tailwind CSS 3, `tailwindcss-animate`, CSS custom properties for theming |
| Components | Radix UI primitives wrapped shadcn/ui-style; `class-variance-authority`, `clsx`, `tailwind-merge` |
| Forms | React Hook Form + `@hookform/resolvers` |
| Dates | `date-fns`, `react-day-picker` |
| Icons | `lucide-react`, `@radix-ui/react-icons` |
| Command palette | `cmdk` |

`zod` is listed as a dependency but is not imported anywhere yet — it is the intended validation layer for the schemas in `src/models/schemas/`.

---

## Data model

Database: **`parceflyte`**. Collections below; field lists are the load-bearing subset, not exhaustive.

### `users`

```js
{
  auth0Id, email,                             // unique identity keys
  firstName, lastName, phoneNumber, dateOfBirth,
  address: { street, city, state, country, postalCode },
  kycStatus: 'pending' | 'verified' | 'rejected',
  kycDocuments: [{ type: 'passport'|'drivers_license'|'national_id',
                   documentNumber, expiryDate, verificationDate, verifiedBy }],
  roles: ['sender' | 'carrier' | 'admin'],
  rating: { average, totalReviews, completedDeliveries, successfulDeliveries },
  paymentMethods: [{ type: 'stripe'|'paypal'|'bank_transfer', ... }],
  isActive, createdAt, updatedAt
}
```

`rating.average` and `rating.totalReviews` are denormalized onto the user and recomputed by the ratings API after each new review — the matching engine reads them directly, so it never has to aggregate the `ratings` collection.

### `travels`

```js
{
  carrierId,
  departureLocation: { city, country, ... },
  arrivalLocation:   { city, country, ... },
  travelMode: 'air' | 'land' | 'sea' | 'mixed',
  transportDetails: { type: 'plane'|'train'|'bus'|'car'|'ship'|'other', ... },
  departureDate, arrivalDate,
  availableCapacity: { weight, volume },       // decremented when a match is accepted
  baseDeliveryFee,
  status: 'planned' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled',
  verificationMethod: 'manual' | 'document_upload' | 'third_party',
  rating: { average, ... }
}
```

Only travels in `planned` or `confirmed` status are considered by the matching engine.

### `parcels`

```js
{
  senderId, matchedCarrierId,
  weight, volume, dimensions,
  declaredValue,                               // drives the 15% fee ceiling
  category: 'electronics'|'clothing'|'documents'|'books'|'food'|'cosmetics'|'other',
  specialHandling: ['fragile'|'temperature_controlled'|'urgent'
                   |'signature_required'|'photo_proof'],
  recipient: { name, phone, address: { city, country, ... } },
  deliveryDeadline,
  preferredDeliveryTime: 'anytime'|'morning'|'afternoon'|'evening',
  status: 'pending'|'matched'|'in_transit'|'delivered'|'cancelled'|'lost',
  paymentStatus: 'pending'|'paid'|'released'|'refunded',
  trackingHistory: [{ status: 'created'|'matched'|'picked_up'|'in_transit'
                             |'out_for_delivery'|'delivered'|'failed_delivery',
                      timestamp, location, note }],
  insuranceRequired, insuranceAmount,
  disputes: [{ reason: 'damage'|'delay'|'non_delivery'|'wrong_item'|'other',
               status: 'open'|'under_review'|'resolved'|'closed' }]
}
```

### `matches`

```js
{
  parcelId, travelId, senderId, carrierId,
  status: 'proposed' | 'accepted' | 'rejected' | 'expired' | 'cancelled',
  matchScore,                                  // 0–1 from the matching engine
  negotiation: {
    initialFee, proposedFee, finalFee, currency,
    negotiationHistory: [{ proposedBy, amount, message, timestamp }]
  },
  agreement: {
    pickupLocation, pickupDate,
    deliveryLocation, deliveryDate,
    specialInstructions, insuranceRequired, insuranceAmount
  },
  messages: [{ senderId, message, timestamp, isRead }],
  expiresAt, createdAt, updatedAt
}
```

`negotiationHistory` is an append-only audit trail — every counter-offer from either side is retained, so the full bargaining sequence is reconstructible.

### `payments`

```js
{
  matchId, parcelId, senderId, carrierId,
  amount, currency,
  paymentMethod: 'stripe' | 'paypal' | 'bank_transfer' | 'crypto',
  status: 'pending'|'processing'|'completed'|'failed'|'refunded'|'disputed',
  escrowStatus: 'funded' | 'released' | 'refunded' | 'disputed',
  releaseCondition: 'delivery_confirmed' | 'time_elapsed' | 'manual_release',
  disputes: [{ reason: 'non_delivery'|'damage'|'delay'|'wrong_item'|'other',
               status: 'open'|'under_review'|'resolved'|'closed',
               priority: 'low'|'medium'|'high' }]
}
```

One payment per match — the create handler rejects a second payment for a `matchId` that already has one.

### `ratings`

```js
{
  parcelId, reviewerId, reviewedId,
  ratingType: 'sender_to_carrier' | 'carrier_to_sender',
  score, review,
  status: 'pending' | 'published' | 'flagged' | 'removed',
  flags: [{ reason: 'inappropriate'|'spam'|'fake'|'harassment'|'other' }],
  helpfulness: [{ userId, vote: 'helpful' | 'not_helpful' }]
}
```

One rating per (parcel, reviewer, direction) — duplicates are rejected. On write, the reviewed user's aggregate `rating` is recomputed and written back to the `users` document.

### `kyc`

Documented in detail under [KYC and compliance subsystem](#kyc-and-compliance-subsystem).

---

## API reference

All routes live under `parceflyte-v1/src/app/api/`. Every route except `/api/auth/[auth0]` is wrapped in `withApiAuthRequired` and requests a scoped access token. Collection endpoints accept `page` and `limit` query params and return `{ data, pagination: { page, limit, total } }`.

### Auth

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/auth/[auth0]` | Auth0 `handleAuth()` — serves `/login`, `/logout`, `/callback`, `/me` |

### Users — [`api/users/`](parceflyte-v1/src/app/api/users/)

| Method | Route | Scope | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/users` | `read:users` | Filter by `role`, `kycStatus` |
| `POST` | `/api/users` | `write:users` | Rejects a duplicate `auth0Id` |
| `GET` | `/api/users/[id]` | `read:users` | `id` accepts an ObjectId **or** an `auth0Id` |
| `PUT` | `/api/users/[id]` | `write:users` | |
| `DELETE` | `/api/users/[id]` | `write:users` | Soft delete — sets `isActive: false` |

### Travels — [`api/travels/`](parceflyte-v1/src/app/api/travels/)

| Method | Route | Scope | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/travels` | `read:travels` | Filters: `carrierId`, `departureCity/Country`, `arrivalCity/Country`, `travelMode`, `status`, `minCapacity`, `maxFee`, `departureDate`, `arrivalDate` |
| `POST` | `/api/travels` | `write:travels` | Requires `carrierId`, both locations, `travelMode`, both dates, `availableCapacity`, `baseDeliveryFee` |
| `GET` | `/api/flights` | `read:flights` | **Legacy duplicate** of `GET /api/travels` (same query, different default `limit` and scope). Prefer `/api/travels`. |

### Parcels — [`api/parcels/`](parceflyte-v1/src/app/api/parcels/)

| Method | Route | Scope | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/parcels` | `read:parcels` | Filters: `senderId`, `matchedCarrierId`, `status`, `category`, `min/maxWeight`, `min/maxValue`, `deliveryDeadline` |
| `POST` | `/api/parcels` | `write:parcels` | |

### Matches — [`api/matches/`](parceflyte-v1/src/app/api/matches/)

| Method | Route | Scope | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/matches` | `read:matches` | Filters: `parcelId`, `travelId`, `senderId`, `carrierId`, `status`, `minScore`, `maxFee` |
| `POST` | `/api/matches` | `write:matches` | Verifies parcel and travel exist; rejects a duplicate (parcel, travel) pair |
| `GET` | `/api/matches/[id]` | `read:matches` | |
| `PUT` | `/api/matches/[id]` | `write:matches` | |
| `DELETE` | `/api/matches/[id]` | `write:matches` | Soft cancel |
| `POST` | `/api/matches/[id]/accept` | `write:matches` | Transactional-ish: sets match `accepted`, parcel `matched`, decrements travel capacity |
| `POST` | `/api/matches/[id]/reject` | `write:matches` | |
| `POST` | `/api/matches/[id]/negotiate` | `write:matches` | Appends a counter-offer (see below) |
| `GET` | `/api/matches/[id]/negotiate` | `read:matches` | Full negotiation history |

### Matching and search

| Method | Route | Scope | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/matching` | `read:matches` | Scored candidates via the matching engine. With `parcelId`, scores against that parcel; otherwise searches by raw criteria |
| `POST` | `/api/matching` | `write:matches` | Creates a match after re-verifying parcel, travel, and carrier |
| `POST` | `/api/matching/auto` | `write:matches` | Auto-creates match records for the top-scoring candidates of a parcel |
| `GET` | `/api/matching/auto` | `read:matches` | Preview auto-match suggestions without persisting (default `limit` 5) |
| `GET` | `/api/search` | `read:search` | Carrier discovery. Overlaps heavily with `GET /api/matching` |

Shared query params for discovery: `parcelId`, `departureCity`, `arrivalCity`, `departureCountry`, `arrivalCountry`, `weight`, `volume`, `maxFee`, `deliveryDeadline`, `travelMode`, `minRating`.

### Payments — [`api/payments/`](parceflyte-v1/src/app/api/payments/)

| Method | Route | Scope | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/payments` | `read:payments` | Filters: `parcelId`, `matchId`, `senderId`, `carrierId`, `status`, `escrowStatus`, `min/maxAmount` |
| `POST` | `/api/payments` | `write:payments` | Requires an existing match; one payment per match; updates the parcel's `paymentStatus` |

### Ratings — [`api/ratings/`](parceflyte-v1/src/app/api/ratings/)

| Method | Route | Scope | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/ratings` | `read:ratings` | Filters: `parcelId`, `reviewerId`, `reviewedId`, `ratingType`, `status`, `min/maxRating` |
| `POST` | `/api/ratings` | `write:ratings` | Requires a delivered parcel; blocks duplicates; recomputes the reviewed user's aggregate rating |

---

## Matching engine

[`src/lib/matching-service.js`](parceflyte-v1/src/lib/matching-service.js) scores every viable (parcel, travel) pair on five weighted factors:

| Factor | Weight | Scoring rule |
| --- | --- | --- |
| **Route** | 35% | 0.5 per exact city match (departure, arrival); 0.25 per country-only match. Capped at 1.0 |
| **Capacity** | 25% | Mean of the weight and volume utilization ratios. Utilization above 80% scores a full 1.0 — the engine prefers filling a carrier's remaining space over leaving it fragmented |
| **Timing** | 20% | 0 if the travel arrives after the delivery deadline (hard fail). 1.0 for a 1–7 day buffer, 0.8 for more than 7 days, 0.5 for under 1 day |
| **Price** | 10% | 0 if the base fee exceeds 15% of the parcel's declared value. Otherwise `max(0.5, 1 − fee/value)` |
| **Rating** | 10% | `average / 5`, plus a trust bonus of +0.1 at 10+ reviews or +0.05 at 5+. New carriers get a neutral 0.5 rather than a 0 |

The score is a weighted sum rounded to two decimals.

### Pre-filtering

Scoring only runs on travels that already pass a MongoDB query:

```js
status: { $in: ['planned', 'confirmed'] },
'availableCapacity.weight': { $gte: parcel.weight },
'availableCapacity.volume': { $gte: parcel.volume },
departureDate:  { $lte: new Date(parcel.deliveryDeadline) }
```

Optional filters (`maxFee`, `minRating`, `travelMode`, departure/arrival country) narrow this further. Results are pulled sorted by carrier rating, capped at 50 candidates, then scored and re-sorted by score. Carrier documents are fetched in a single `$in` batch and joined in memory, so scoring a full candidate set costs two queries, not N+1.

### Auto-matching

`autoMatchParcel()` keeps only matches scoring **≥ 70** and returns the top 5.

> **Note:** `calculateMatchScore()` returns a 0–1 value, so the `>= 70` threshold in `autoMatchParcel()` filters out everything. Either the threshold should be `0.70` or the score should be scaled to 0–100 — resolve this before relying on auto-matching.

### Fee estimation

`calculateEstimatedFee()` starts from the travel's `baseDeliveryFee` and applies:

- **+10%** if the parcel requires any special handling
- **+ insurance** — the explicit `insuranceAmount`, or 2% of declared value
- **+5%** for long distance (over 1000 km)

`calculateDistance()` is a **stub returning a constant 500 km**, so the long-distance premium never currently fires. Wiring in real geocoding is the first thing to fix here.

### Price suggestion

`suggestPricing()` proposes a negotiation window: floor at 90% of base fee, ceiling at the lower of 120% of base fee or 15% of declared value, with the midpoint as the opening suggestion.

---

## Negotiation flow

Fee bargaining happens on the match, before acceptance.

```
Match created (status: proposed, negotiation.initialFee set)
        │
        ▼
POST /api/matches/[id]/negotiate  { proposedBy, proposedFee, message }
        │
        ├── reject if match.status !== 'proposed'
        ├── reject if now > match.expiresAt
        ├── reject if proposedBy is neither senderId nor carrierId
        ├── reject if proposedFee > parcel.declaredValue * 0.15
        │
        ▼
append { proposedBy, amount, message, timestamp } to negotiation.negotiationHistory
set negotiation.proposedFee
        │
        ▼  (repeat as many rounds as both sides want, until expiry)
        │
POST /api/matches/[id]/accept  ──► status: accepted, finalFee locked,
                                    parcel → matched, travel capacity decremented
```

The **15% of declared value** ceiling is enforced in two independent places — the matching engine's price score and the negotiate endpoint — so a fee above it can neither be recommended nor agreed to.

The UI for this is [`match-negotiation-modal.jsx`](parceflyte-v1/src/components/match-negotiation-modal.jsx), a stepper that shows the running history and the suggested price band, paired with [`match-details-card.jsx`](parceflyte-v1/src/components/match-details-card.jsx), which renders the per-factor score breakdown (route, capacity, timing, price, carrier) returned alongside every match.

---

## Payments and escrow

Payment is escrow-first: funds are captured when a match is accepted and held until the delivery outcome is known.

```
match accepted
     │
     ▼
POST /api/payments  ──► escrowStatus: 'funded'
                        parcel.paymentStatus: 'paid'
     │
     ├── delivery confirmed ────► escrowStatus: 'released'  → parcel.paymentStatus: 'released'
     ├── release condition met ─► 'time_elapsed' / 'manual_release'
     └── dispute opened ────────► escrowStatus: 'disputed'  → admin resolution
                                  └─ refund ► 'refunded'
```

Release conditions are modeled (`delivery_confirmed`, `time_elapsed`, `manual_release`) and disputes carry a reason, status, and priority. The **payment provider integration is not built** — `paymentMethod` accepts `stripe`, `paypal`, `bank_transfer`, and `crypto`, but no provider SDK is wired up and no release/refund endpoint exists yet. `POST /api/payments` records the intent and marks the parcel paid.

---

## KYC and compliance subsystem

The KYC layer verifies identity, scores risk, screens against compliance lists, and routes edge cases to a human reviewer. It gates matching eligibility and payment capability: `users.kycStatus` is a filterable field on the users API, and the KYC record is the source of truth behind it.

### Verification pipeline

```
1. Application submitted    → validate required fields, initial risk score, status: pending
2. Documents uploaded       → store securely, AI document check, face match + liveness
3. Automated checks         → risk assessment · PEP · sanctions · AML · authenticity + OCR
4. Admin review             → manual review of flagged cases, request more info, approve/reject
5. Status update            → notify user, append to audit trail, update users.kycStatus
```

### KYC document shape

```js
{
  kycId, userId,
  personalInfo: { firstName, lastName, middleName, dateOfBirth, nationality,
                  gender: 'male'|'female'|'other'|'prefer_not_to_say' },
  address: { currentAddress: { street, city, state, country, postalCode,
                               coordinates: { latitude, longitude } },
             previousAddresses: [...] },
  contactInfo: { phoneNumber, email, emergencyContact },
  identityDocuments: [{
    documentType: 'passport'|'drivers_license'|'national_id'
                 |'birth_certificate'|'utility_bill',
    documentNumber, issuingCountry, issueDate, expiryDate,
    documentImages: [{ type: 'front'|'back'|'selfie_with_document',
                       imageUrl, uploadedAt, verifiedAt,
                       verificationMethod: 'manual'|'ai'|'third_party' }],
    verificationStatus: 'pending'|'verified'|'rejected'|'expired'
  }],
  employment: { employmentStatus: 'employed'|'self_employed'|'unemployed'
                                 |'student'|'retired',
                employer, jobTitle, monthlyIncome },
  financialInfo: { bankAccounts: [{ accountType: 'checking'|'savings'|'business' }],
                   creditCards: [{ cardType: 'visa'|'mastercard'|'amex'|'discover' }] },
  verificationProcess: { status: 'pending'|'in_review'|'approved'|'rejected'
                                |'requires_additional_info',
                         submittedAt, reviewedAt, approvedAt, rejectionReason },
  riskAssessment: { riskScore, riskLevel: 'low'|'medium'|'high'|'very_high',
                    riskFactors: [...], flagged },
  compliance: { pepCheck, sanctionsCheck, amlCheck },
  documentVerification: { faceMatch, documentAuthenticity, livenessCheck },
  communicationHistory: [{ channel: 'email'|'sms'|'in_app'|'phone', ... }],
  auditTrail: [{ action: 'submitted'|'reviewed'|'approved'|'rejected'
                        |'updated'|'document_uploaded', ... }],
  expiration: { expiresAt, renewalReminderSent, autoRenewal }
}
```

### Risk scoring

| Risk factor | Points |
| --- | --- |
| New user (account under 30 days old) | +20 |
| International address (non-US) | +15 |
| Document issues (rejected or expired) | +30 |
| High-value transactions | +25 |
| Suspicious activity patterns | +40 |

| Level | Score range |
| --- | --- |
| Low | 0–19 |
| Medium | 20–34 |
| High | 35–49 |
| Very high | 50+ |

### Compliance screening

- **PEP** — screens against politically exposed persons databases; hits are flagged for manual review rather than auto-rejected.
- **Sanctions** — real-time sanctions list checks; matches block the account.
- **AML** — transaction pattern analysis and suspicious activity detection, with regulatory reporting hooks.

### Document verification methods

Face matching against the selfie, document authenticity checks (hologram and watermark detection), liveness detection to defeat photo spoofing, and OCR extraction to cross-check typed data against the document.

### Planned KYC API

These endpoints are **called by the existing UI components but not yet implemented** — building them is the largest open work item in the repo.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/kyc` | Fetch the current user's KYC application |
| `POST` | `/api/kyc` | Submit a new application |
| `PUT` | `/api/kyc` | Update an application |
| `POST` | `/api/kyc/documents` | Upload identity documents |
| `GET` | `/api/kyc/documents` | Document verification status |
| `POST` | `/api/kyc/verify` | Run automated verification checks |
| `GET` | `/api/kyc/verify` | Verification status and results |
| `GET` | `/api/admin/kyc` | Review queue and statistics (`?status=statistics`) — admin |
| `POST` | `/api/admin/kyc` | Approve/reject with notes — admin |
| `PUT` | `/api/admin/kyc` | Admin-side application update |

The intended security posture for this data: encryption at rest for documents, role-based admin access with MFA, an immutable audit trail on every action, and GDPR-compliant retention and erasure. External integrations anticipated here are a document verification provider, a PEP/sanctions data provider, email and SMS delivery, and object storage for document images.

---

## Authentication and authorization

Auth0 handles the full session lifecycle through the catch-all route at [`api/auth/[auth0]/route.js`](parceflyte-v1/src/app/api/auth/[auth0]/route.js), which mounts `/api/auth/login`, `/logout`, `/callback`, and `/me`.

**Server side** — every API handler is wrapped:

```js
export const GET = withApiAuthRequired(async function getParcels(req) {
  const { accessToken } = await getAccessToken(req, { scopes: ['read:parcels'] });
  // ...
});
```

**Client side** — components read the session with the `useUser()` hook from `@auth0/nextjs-auth0/client`.

### Scope catalog

Define these as permissions on your Auth0 API and assign them to roles:

| Resource | Read | Write |
| --- | --- | --- |
| Users | `read:users` | `write:users` |
| Parcels | `read:parcels` | `write:parcels` |
| Travels | `read:travels` | `write:travels` |
| Flights (legacy) | `read:flights` | — |
| Matches | `read:matches` | `write:matches` |
| Payments | `read:payments` | `write:payments` |
| Ratings | `read:ratings` | `write:ratings` |
| Search | `read:search` | — |

Admin capability is expressed by granting the full scope set plus the `admin` role on the user document; there is no separate `admin:*` scope namespace yet.

---

## Frontend architecture

**Routing.** App Router with a `(auth)` route group — `login` and `register` share layout treatment without adding an `/auth` URL segment.

**Component layers.** Three tiers, in dependency order:

1. `components/ui/` — shadcn/ui-style primitives wrapping Radix (dialog, popover, command, calendar, form, toast, …). Styled with `class-variance-authority` variants; class conflicts resolved by `cn()` in [`lib/utils.js`](parceflyte-v1/src/lib/utils.js) (`clsx` + `tailwind-merge`).
2. `components/home/` — marketing page sections (navbar, hero, hero-cards, about, features).
3. Feature components at the root of `components/` — the negotiation modal, match details card, and the three KYC components.

**Theming.** `globals.css` declares HSL CSS custom properties (`--background`, `--foreground`, …) consumed by Tailwind, giving light/dark theming without duplicating utility classes.

**Data flow.** All components are `'use client'` and fetch from the API routes directly. There is no shared client-side store or data-fetching library — each component owns its own `useState` and `fetch`.

### Pages

| Route | Purpose |
| --- | --- |
| `/` | Marketing home — hero, about, features |
| `/login`, `/register` | Auth entry points using the shared `UserAuthForm` |
| `/dashboard` | Main workspace — post travel/parcel, search, calendar and command-palette driven |
| `/admin/kyc` | KYC review queue and admin approve/reject |
| `/kyc-test` | Demo harness for the KYC stepper |
| `/test-negotiation` | Demo harness for the negotiation modal and match card |

`/kyc-test` and `/test-negotiation` are development scaffolding — delete or route-guard them before any production deploy.

---

## Getting started

### Prerequisites

- Node.js 18.17+
- MongoDB running locally, or a MongoDB Atlas connection string
- An Auth0 tenant with an API configured for the scopes listed above

### 1. Clone and install

```bash
git clone https://github.com/yourusername/parceflyte.git
cd ParceFlyte/parceflyte-v1
npm install
```

### 2. Restore the missing config files

The repo is currently missing build configuration that the source assumes (see [Implementation status](#implementation-status)). Create these in `parceflyte-v1/` before your first run:

`jsconfig.json` — required for every `@/…` import to resolve:

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`tailwind.config.js` — required for any styling to render:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
    './src/app/**/*.{js,jsx}',
  ],
  theme: {
    container: { center: true, padding: '2rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

`postcss.config.mjs`:

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

`.gitignore`:

```
node_modules/
.next/
.env*.local
.DS_Store
```

### 3. Environment variables

Create `parceflyte-v1/.env.local`:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/parceflyte

# Auth0 — AUTH0_SECRET: openssl rand -hex 32
AUTH0_SECRET=your_auth0_secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_CLIENT_SECRET=your_auth0_client_secret
AUTH0_AUDIENCE=https://api.parceflyte.com
AUTH0_SCOPE=openid profile email
```

`AUTH0_AUDIENCE` must match the identifier of the Auth0 API that defines the scopes — without it, `getAccessToken()` cannot issue scoped tokens and every API route will fail.

In your Auth0 application settings, set the allowed callback URL to `http://localhost:3000/api/auth/callback` and the allowed logout URL to `http://localhost:3000`.

### 4. Run

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm start        # serve the production build
npm run lint     # ESLint (note: errors are ignored during builds)
```

### Recommended MongoDB indexes

None are created by the application. Add these before any meaningful data volume:

```js
db.users.createIndex({ auth0Id: 1 }, { unique: true })
db.users.createIndex({ email: 1 }, { unique: true })
db.travels.createIndex({ status: 1, departureDate: 1 })
db.travels.createIndex({ 'departureLocation.city': 1, 'arrivalLocation.city': 1 })
db.travels.createIndex({ carrierId: 1 })
db.parcels.createIndex({ senderId: 1, status: 1 })
db.parcels.createIndex({ deliveryDeadline: 1 })
db.matches.createIndex({ parcelId: 1, travelId: 1 })
db.matches.createIndex({ senderId: 1, status: 1 })
db.matches.createIndex({ carrierId: 1, status: 1 })
db.payments.createIndex({ matchId: 1 }, { unique: true })
db.ratings.createIndex({ reviewedId: 1, status: 1 })
```

The `travels` compound index on `status` + `departureDate` directly serves the matching engine's pre-filter, which is the hottest query in the system.

---

## Implementation status

### Working

- MongoDB connection layer with HMR-safe pooling
- Users, travels, parcels, matches, payments, ratings CRUD
- Matching engine with weighted scoring and candidate pre-filtering
- Accept / reject / negotiate match lifecycle with capacity decrementing
- Rating aggregation write-back to user documents
- Auth0 session handling and scope-gated API routes
- Full marketing site, dashboard, and KYC/negotiation UI components

### Missing or broken — read before running

| Item | Impact |
| --- | --- |
| **`jsconfig.json` absent** | Every `@/…` import fails to resolve. The app will not build. Restore it (see [step 2](#2-restore-the-missing-config-files)) |
| **`tailwind.config.js` and PostCSS config absent** | `globals.css` emits Tailwind directives with nothing to process them — no styles render |
| **`.gitignore` absent** | `node_modules/` and `.next/` are at risk of being committed |
| **KYC API routes not implemented** | The KYC onboarding form, stepper, and admin review modal call `/api/kyc`, `/api/kyc/documents`, `/api/kyc/verify`, and `/api/admin/kyc` — all 404. The entire KYC subsystem is UI-only |
| **`models/schemas/flight.js` imports mongoose** | Mongoose is not a dependency. The file is an unused leftover from an earlier design; nothing imports it. Delete it |
| **`zod` unused** | Declared as a dependency but never imported. Schema validation is inline and inconsistent across routes |
| **`autoMatchParcel()` threshold mismatch** | Filters on `matchScore >= 70` against a 0–1 score, so it always returns empty |
| **`calculateDistance()` is a stub** | Returns a constant 500 km; the distance-based fee premium never applies |
| **`GET /api/flights` duplicates `GET /api/travels`** | Two routes, one behavior, different scopes. Consolidate onto `/api/travels` |
| **`GET /api/matching` and `GET /api/search` overlap** | Near-identical discovery logic in two places |
| **No payment provider integration** | Escrow is modeled but no funds move; no release or refund endpoint exists |
| **ESLint errors ignored at build time** | `next.config.mjs` sets `ignoreDuringBuilds: true`, so lint failures do not block a deploy |
| **No tests** | No test runner or test files in the repo |
| **Demo routes shipped** | `/kyc-test` and `/test-negotiation` are unguarded |

---

## Roadmap

**Near term** — restore the build config, implement the KYC API surface, fix the auto-match threshold, deduplicate the flights/travels and matching/search routes, adopt zod for request validation at the route boundary, and add the MongoDB indexes.

**Medium term** — wire a real payment provider with escrow release and refund endpoints, replace the distance stub with a geocoding service, add real-time messaging on matches, add parcel tracking with notifications, and stand up a test suite.

**Longer term** — biometric verification and third-party document verification providers, ML-based fraud detection, a native mobile app, multi-language support, and decomposition of matching and KYC into independently deployable services if load requires it.

---

## License

MIT

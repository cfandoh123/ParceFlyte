# ParceFlyte

ParceFlyte is a peer-to-peer parcel delivery platform that connects senders with travellers (carriers) who have spare luggage capacity along a route they are already taking. It handles carrier discovery, multi-factor match scoring, fee negotiation, escrowed payment, two-sided ratings, and a KYC/compliance layer with an admin review queue.

**It runs with zero configuration.** Clone, `npm install`, `npm run dev` — no database, no Auth0 tenant. The app boots in demo mode against a seeded in-memory dataset and a fixed demo user, so every screen is explorable immediately. Point `MONGODB_URI` and the Auth0 variables at real infrastructure and the same code runs against those instead.

---

## Table of contents

- [Quick start](#quick-start)
- [Domain model](#domain-model)
- [System architecture](#system-architecture)
- [Demo mode](#demo-mode)
- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Matching engine](#matching-engine)
- [Fee rules and negotiation](#fee-rules-and-negotiation)
- [Payments and escrow](#payments-and-escrow)
- [KYC and compliance](#kyc-and-compliance)
- [Authentication and authorization](#authentication-and-authorization)
- [Frontend architecture](#frontend-architecture)
- [Running against MongoDB and Auth0](#running-against-mongodb-and-auth0)
- [Known gaps](#known-gaps)
- [License](#license)

---

## Quick start

```bash
git clone https://github.com/yourusername/parceflyte.git
cd ParceFlyte
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You are signed in as **Calvin Andoh**, a seeded user with parcels in flight, an upcoming trip, an open negotiation, and the admin role.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run seed` | Load the demo dataset + indexes into MongoDB (needs `MONGODB_URI`) |

### A tour worth taking

1. **`/dashboard`** — counters, and anything waiting on your reply pinned to the top.
2. **`/parcels/652f1c0000000000000000c1`** — the matching engine's output. Every carrier on the route scored 0–100; hit **Why this score?** for the per-factor breakdown and the fee build-up.
3. **`/matches`** → **Respond** — the negotiation thread. Counter-offer, accept, or decline. The guardrails are live: you cannot counter twice in a row, accept your own offer, or exceed the fee cap.
4. After accepting, open the parcel and walk it through **picked up → in transit → delivered**. Escrow releases on delivery, and a review form appears.
5. **Leave a review** — the score feeds straight back into that carrier's reputation, which is 10% of every future match score.
6. **`/kyc`** — the three-step verification flow. Clean applications auto-approve; flagged ones route to review.
7. **`/admin/kyc`** — the review queue, with risk scores and compliance results.

**Reset data** in the top banner restores the seed at any point.

---

## Domain model

| Entity | Meaning |
| --- | --- |
| **User** | An account: identity, roles (`sender` / `carrier` / `admin`), KYC status, and an aggregate rating. |
| **Travel** | A trip a carrier is taking — origin, destination, dates, mode, spare weight/volume, base fee. |
| **Parcel** | Something to deliver — origin, recipient, weight, volume, declared value, handling needs, deadline. |
| **Match** | A proposed pairing of one parcel with one travel. Holds the score, the negotiation thread, the agreed terms. |
| **Payment** | Money escrowed against an accepted match, released on delivery or refunded on dispute. |
| **Rating** | Two-sided post-delivery review. |
| **KYC** | Identity verification, risk score, and compliance screening for a user. |

```
sender posts Parcel ─┐
                     ├─► engine scores candidate pairs ─► Match (proposed)
carrier posts Travel ┘                                        │
                                                              ▼
                                             negotiate fee (either side counters)
                                                              │
                                                              ▼
                                    accept ─► escrow funded, capacity decremented,
                                              competing matches expired
                                                              │
                                                              ▼
                                    picked up → in transit → delivered
                                                              │
                                                              ▼
                                     escrow released ─► both parties rate each other
```

---

## System architecture

One Next.js 14 App Router application. No separate backend — API routes and React pages deploy as a unit and talk to the data layer directly.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser — React 18 client components, Tailwind, Radix               │
│  SessionProvider bootstraps from /api/session                        │
│  AppShell provides nav chrome for every signed-in page               │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ fetch()
┌──────────────────────────────▼───────────────────────────────────────┐
│  Next.js App Router (src/app)                                        │
│                                                                      │
│  Every route wrapped in withAuth(scopes, handler) — src/lib/auth.js   │
│  Delegates to Auth0 when configured, demo session when not           │
│                                                                      │
│  /api/session   /api/users    /api/travels   /api/parcels            │
│  /api/matches   ├─ [id]/accept · reject · negotiate                  │
│  /api/matching  ├─ /auto                                             │
│  /api/payments  /api/ratings  /api/kyc  /api/admin/kyc               │
│  /api/demo/reset                                                     │
└────────────┬──────────────────────────────┬──────────────────────────┘
             │                              │
┌────────────▼────────────┐   ┌─────────────▼──────────────────────────┐
│ matching-service.js     │   │ kyc-service.js                         │
│ weighted scoring, fee   │   │ risk scoring, compliance screening,    │
│ quoting, distance       │   │ document verification                  │
└────────────┬────────────┘   └─────────────┬──────────────────────────┘
             │                              │
┌────────────▼──────────────────────────────▼──────────────────────────┐
│  src/lib/db.js — getDb()                                             │
│                                                                      │
│    MONGODB_URI set?  ──yes──►  MongoDB (native driver)               │
│                      ──no───►  demo-store.js (in-memory)             │
│                                                                      │
│  Both expose the same .collection(name) surface, so no route         │
│  knows which one it is talking to.                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Key decisions

**One data interface, two backends.** [`src/lib/db.js`](src/lib/db.js) exports `getDb()`. [`src/lib/demo-store.js`](src/lib/demo-store.js) implements the subset of the MongoDB collection API the routes use — `find/sort/skip/limit/toArray`, `findOne`, `insertOne`, `updateOne`, `countDocuments`, with `$in`, `$gte`, `$lte`, `$or`, `$regex`, `$set`, `$push`, `$inc`, and dotted paths. This is what makes zero-config startup possible without a second code path through the app.

**`toId()` bridges id types.** Mongo needs `ObjectId`; the demo store compares ids as strings. Every route uses `toId()` and never constructs an `ObjectId` directly, so the same query works on both. Demo ids are 24-char hex, so the seed loads into MongoDB unchanged.

**Auth is a wrapper, not a fork.** Routes call `withAuth(['read:parcels'], handler)`. With Auth0 configured it delegates to `withApiAuthRequired` and requests a scoped token; without it, the handler runs as the demo user. Handlers receive `ctx.user` either way.

**Matching is a stateless singleton.** [`matching-service.js`](src/lib/matching-service.js) holds only weights as state. Every method takes what it needs as arguments, so it is safe to share across concurrent requests and trivial to test.

**Schemas document, routes enforce.** The files in [`src/models/schemas/`](src/models/schemas/) describe document shape. Validation is explicit in each route via `requireFields` and typed checks from [`src/lib/api.js`](src/lib/api.js).

---

## Demo mode

Demo mode is on whenever `MONGODB_URI` is unset, or `NEXT_PUBLIC_DEMO_MODE=true`.

- **Data** comes from [`src/lib/demo-data.js`](src/lib/demo-data.js): 8 users, 13 trips, 5 parcels, 4 matches, payments, ratings, and 3 KYC applications at different stages. Dates are generated relative to load time, so trips are always upcoming and deadlines never stale.
- **State** lives on `globalThis`, so it survives hot module replacement — anything you create while developing is still there after an edit. It resets when the server restarts, or via `POST /api/demo/reset`.
- **The session** is a fixed user (`DEMO_SESSION_USER` in [`src/lib/auth.js`](src/lib/auth.js)) holding the `sender`, `carrier` and `admin` roles so every surface is reachable.
- **File uploads** in the KYC flow record the file name only; nothing is stored.

Auth0 and MongoDB are independent switches. Configuring one without the other works fine.

---

## Repository layout

```
ParceFlyte/
├── jsconfig.json            ← @/* → ./src/*
├── tailwind.config.js       ← theme tokens, including success/warning
├── postcss.config.mjs
├── next.config.mjs
├── .env.example             ← every variable, all optional
├── scripts/
│   └── seed.mjs             ← load demo data + indexes into MongoDB
└── src/
    ├── app/
    │   ├── layout.js                 ← SessionProvider + Toaster
    │   ├── error.js                  ← route-level error boundary
    │   ├── global-error.js           ← root-layout failures
    │   ├── not-found.js              ← 404
    │   ├── page.js                   ← marketing home
    │   ├── (auth)/login · register
    │   ├── dashboard/                ← overview
    │   ├── parcels/  · [id]/         ← list, create, detail + scored carriers
    │   ├── travels/                  ← list, post a trip
    │   ├── browse/                   ← carrier discovery with filters
    │   ├── matches/                  ← negotiation inbox
    │   ├── kyc/                      ← 3-step verification
    │   ├── admin/kyc/                ← review queue
    │   └── api/                      ← see API reference
    │
    ├── components/
    │   ├── ui/                       ← Radix/shadcn primitives
    │   ├── home/                     ← marketing sections
    │   ├── app-shell.jsx             ← sidebar, mobile nav, demo banner
    │   ├── session-provider.jsx      ← useSession()
    │   ├── parcel-form.jsx · travel-form.jsx
    │   ├── match-card.jsx · negotiation-modal.jsx
    │   ├── review-section.jsx · star-rating.jsx
    │   ├── score-badge.jsx           ← score ring + factor breakdown
    │   ├── carrier-badge.jsx · route-line.jsx · empty-state.jsx
    │
    ├── lib/
    │   ├── db.js                     ← getDb(), toId(), isDemoMode()
    │   ├── demo-data.js              ← the seed dataset
    │   ├── demo-store.js             ← in-memory Mongo-compatible store
    │   ├── auth.js                   ← withAuth(), currentUser()
    │   ├── api.js                    ← response helpers, validation
    │   ├── matching-service.js       ← scoring and quoting
    │   ├── kyc-service.js            ← risk, compliance, document checks
    │   ├── matches.js                ← hydrateMatches()
    │   ├── format.js                 ← money, dates, status → badge variant
    │   ├── use-api.js                ← useApi() / apiFetch()
    │   └── utils.js                  ← cn()
    │
    └── models/schemas/               ← document shape reference
```

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router), React 18 |
| Language | JavaScript |
| Data | MongoDB via the native driver, or the in-memory demo store |
| Auth | Auth0 (`@auth0/nextjs-auth0` v3), optional |
| Styling | Tailwind CSS 3 with HSL custom-property tokens |
| Components | Radix primitives, shadcn-style, `class-variance-authority` |
| Icons | `lucide-react` |

---

## Data model

Database `parceflyte`. Load-bearing fields only.

### `users`
```js
{ auth0Id, email, firstName, lastName, phoneNumber, dateOfBirth, avatarColor,
  address: { street, city, state, country, postalCode },
  kycStatus: 'pending' | 'verified' | 'rejected',
  roles: ['sender' | 'carrier' | 'admin'],
  rating: { average, totalReviews, completedDeliveries, successfulDeliveries },
  paymentMethods, isActive, createdAt, updatedAt }
```
`rating.average` is denormalized here and recomputed by the ratings route after each review, so the matching engine never aggregates.

### `travels`
```js
{ carrierId,
  departureLocation / arrivalLocation: { city, country, coordinates: { latitude, longitude } },
  travelMode: 'air'|'land'|'sea'|'mixed',
  transportDetails: { type, carrier, reference },
  departureDate, arrivalDate,
  availableCapacity: { weight, volume },     // decremented on accept
  baseDeliveryFee, currency,
  status: 'planned'|'confirmed'|'in_progress'|'completed'|'cancelled',
  verificationMethod, notes }
```
Coordinates are attached on write from a known-cities table, which is what makes real distance calculation possible.

### `parcels`
```js
{ senderId, title, description,
  origin: { city, country, coordinates },     // where it is collected
  recipient: { name, phone, address: { city, country, coordinates } },
  weight, volume, dimensions, declaredValue,
  category, specialHandling: [...],
  deliveryDeadline, preferredDeliveryTime,
  status: 'pending'|'matched'|'in_transit'|'delivered'|'cancelled'|'lost',
  paymentStatus: 'pending'|'paid'|'released'|'refunded',
  matchedCarrierId, matchId,
  insuranceRequired, insuranceAmount,
  trackingHistory: [{ status, timestamp, location, note }],
  disputes: [...] }
```
`origin` is separate from `recipient.address`. Both legs are needed to score a route.

### `matches`
```js
{ parcelId, travelId, senderId, carrierId,
  status: 'proposed'|'accepted'|'rejected'|'expired'|'cancelled',
  matchScore,                                  // 0-100
  proposedBy, autoMatched,
  negotiation: { initialFee, proposedFee, finalFee, currency, suggestedRange,
                 negotiationHistory: [{ proposedBy, proposedByRole, amount, message, timestamp }] },
  agreement: { pickupLocation, pickupDate, deliveryLocation, deliveryDate,
               specialInstructions, insuranceRequired, insuranceAmount },
  expiresAt, acceptedAt, createdAt, updatedAt }
```
`negotiationHistory` is append-only — the whole bargaining sequence is reconstructible.

### `payments`
```js
{ matchId, parcelId, senderId, carrierId, amount, currency, paymentMethod,
  status: 'pending'|'processing'|'completed'|'failed'|'refunded'|'disputed',
  escrowStatus: 'funded'|'released'|'refunded'|'disputed',
  releaseCondition: 'delivery_confirmed'|'time_elapsed'|'manual_release',
  disputes: [{ reason, description, status, priority, raisedBy, raisedAt }] }
```

### `ratings`
```js
{ parcelId, reviewerId, reviewedId,
  ratingType: 'sender_to_carrier'|'carrier_to_sender',
  score, review, status, flags, helpfulness }
```

### `kyc`
```js
{ kycId, userId, personalInfo, address, contactInfo,
  identityDocuments: [{ documentType, documentNumber, issuingCountry, issueDate,
                        expiryDate, documentImages: [...], verificationStatus }],
  employment, financialInfo,
  verificationProcess: { status, submittedAt, reviewedAt, approvedAt,
                         rejectionReason, reviewedBy, reviewNotes },
  riskAssessment: { riskScore, riskLevel, riskFactors, flagged },
  compliance: { pepCheck, sanctionsCheck, amlCheck },
  documentVerification: { faceMatch, documentAuthenticity, livenessCheck },
  communicationHistory, auditTrail, expiration }
```

---

## API reference

Every route except `/api/auth/[auth0]` and `/api/demo/reset` goes through `withAuth`. Collection endpoints take `page` and `limit` and return `{ data, pagination: { page, limit, total, totalPages, hasMore } }`.

### Session and demo
| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/session` | Signed-in user + whether demo mode is on. The client bootstraps from this. |
| `POST` | `/api/demo/reset` | Restore the seed. Demo mode only — 403 otherwise. |
| `GET`/`POST` | `/api/auth/[auth0]` | Auth0 login/logout/callback/me; redirects in demo mode. |

### Users — `read:users` / `write:users`
| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/users` | Filters: `role`, `kycStatus` |
| `POST` | `/api/users` | Rejects duplicate `auth0Id` or `email`; validates roles |
| `GET`/`PUT`/`DELETE` | `/api/users/[id]` | `id` is an ObjectId or an `auth0Id`. PUT refuses `kycStatus` and `rating`. DELETE is a soft deactivate. |

### Travels — `read:travels` / `write:travels`
| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/travels` | Filters: `carrierId`, cities, countries, `travelMode`, `status`, `minCapacity`, `maxFee`, dates, `upcoming`. Joins carriers in one query. |
| `POST` | `/api/travels` | Validates mode, date order, positive capacity and fee, distinct cities. Attaches coordinates. |
| `GET`/`PUT`/`DELETE` | `/api/travels/[id]` | Carrier-only. DELETE refuses if accepted matches exist. |

### Parcels — `read:parcels` / `write:parcels`
| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/parcels` | Filters: `senderId`, `matchedCarrierId`, `status`, `category`, weight/value ranges, `deliveryDeadline` |
| `POST` | `/api/parcels` | Validates category, handling flags, future deadline, distinct origin/destination |
| `GET` | `/api/parcels/[id]` | Hydrated with sender and carrier |
| `POST` | `/api/parcels/[id]` | Append a tracking event. `delivered` releases escrow. Participants only. |
| `DELETE` | `/api/parcels/[id]` | Sender-only; refuses once in transit |

### Matches — `read:matches` / `write:matches`
| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/matches` | `mine=true` returns everything you are a party to, either side |
| `POST` | `/api/matches` | Verifies parcel is open, travel is accepting, capacity fits, not self-carriage, no duplicate, fee under cap |
| `GET`/`PUT`/`DELETE` | `/api/matches/[id]` | PUT edits agreement details only — status changes go through the endpoints below |
| `POST` | `/api/matches/[id]/negotiate` | Append a counter-offer |
| `GET` | `/api/matches/[id]/negotiate` | Thread + suggested range + cap |
| `POST` | `/api/matches/[id]/accept` | Locks the fee, matches the parcel, decrements capacity, funds escrow, expires competing matches |
| `POST` | `/api/matches/[id]/reject` | Records who declined and why |

### Matching
| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/matching` | With `parcelId`, returns scored candidates with breakdowns (`mode: "scored"`). Without, a plain travel search (`mode: "browse"`). |
| `GET` | `/api/matching/auto` | Preview candidates above the threshold, creating nothing |
| `POST` | `/api/matching/auto` | Create proposals for everything above the threshold |

### Payments — `read:payments` / `write:payments`
| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/payments` | Filters incl. `escrowStatus`, amount range, `mine` |
| `POST` | `/api/payments` | Fund escrow for an accepted match; one payment per match |
| `PUT` | `/api/payments` | `action`: `release` \| `refund` \| `dispute` |

### Ratings — `read:ratings` / `write:ratings`
| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/ratings` | Attaches reviewer identity |
| `POST` | `/api/ratings` | Requires a delivered parcel and participation; blocks duplicates; recomputes the reviewed user's average |

### KYC
| Method | Route | Notes |
| --- | --- | --- |
| `GET`/`POST`/`PUT` | `/api/kyc` | Your application. POST enforces 18+ and blocks a second in-flight application. |
| `POST` | `/api/kyc/documents` | Upload a document; enforces the required image set per document type; rejects expired documents |
| `GET` | `/api/kyc/documents` | Per-document status, document numbers masked |
| `POST` | `/api/kyc/verify` | Run risk + compliance + document checks; auto-approves when everything is clean |
| `GET` | `/api/kyc/verify` | Status and results |
| `GET` | `/api/admin/kyc` | Review queue, riskiest first. `?status=statistics` returns dashboard counters. |
| `POST` | `/api/admin/kyc` | `decision`: `approve` \| `reject` \| `request_info`. Rejection requires a reason. Mirrors to `users.kycStatus`. |
| `PUT` | `/api/admin/kyc` | Manual risk-score override, recorded in the audit trail |

---

## Matching engine

[`src/lib/matching-service.js`](src/lib/matching-service.js). Each factor scores 0–1; the weighted sum is scaled to **0–100** once, so thresholds read as percentages.

| Factor | Weight | Rule |
| --- | --- | --- |
| **Route** | 35% | Mean of two legs — parcel origin vs travel departure, recipient vs travel arrival. Same city 1.0, same country 0.5, otherwise 0. |
| **Capacity** | 25% | Mean of weight and volume fit. Full marks at 60–100% utilization, tapering below; 0 if it does not fit. Prefers filling a carrier's remaining space over fragmenting it. |
| **Timing** | 20% | 0 if the trip arrives after the deadline or has already departed. 1.0 for a 1–7 day buffer, 0.8 up to 21 days, 0.6 beyond, 0.5 under a day. |
| **Price** | 10% | 0 if the base fee exceeds the parcel's fee ceiling; otherwise linear from 1.0 (free) to 0.5 (at the ceiling). |
| **Rating** | 10% | `average / 5`, plus 0.1 at 10+ reviews or 0.05 at 5+. Carriers with no history get a neutral 0.5 rather than 0. |

### Filtering

Candidates are narrowed by query before scoring — open status, enough weight and volume, departs in the future, arrives before the deadline. Two further filters run after: a carrier cannot carry their own parcel, and **any trip scoring 0 on route is dropped entirely**. A trip from Dubai to Mumbai is not a weak candidate for a London-to-Lagos parcel; it is not a candidate.

Carriers are batch-loaded with a single `$in`, so scoring a full candidate set costs two queries regardless of size.

### Distance

`calculateDistance()` is a real haversine over the coordinates attached to each location, returning kilometres or `null` when coordinates are missing. It drives the distance surcharge and the "5,012 km" shown on each candidate.

### Auto-matching

`autoMatchParcel()` keeps candidates scoring **≥ 70** and returns the top 5. `POST /api/matching/auto` turns those into proposals, skipping pairs that already have one.

---

## Fee rules and negotiation

### The ceiling

A delivery fee may not exceed **the greater of 15% of declared value or $45**.

The 15% rule protects senders of valuable parcels. On its own it makes cheap parcels undeliverable — a $60 document envelope would cap the fee at $9, which no carrier would accept. The floor keeps low-value parcels matchable; the percentage is what binds once a parcel is worth a few hundred dollars. Both live in `MatchingService.MAX_FEE_RATIO` and `MIN_FEE_CEILING`.

The ceiling is enforced in three places that cannot disagree, because they all call `maxAcceptableFee()`: the price score, the opening fee on match creation, and every counter-offer.

### The quote

`quote()` itemises what a delivery costs:

```
carrier's base fee
  + 10%  if the parcel needs special handling
  + 5%   over 1,000 km, or 10% over 5,000 km
  ─────
  = delivery fee, clamped to the ceiling
  + insurance (2% of declared value, if requested)
  ─────
  = total the sender pays
```

Insurance is priced separately from the carrier's fee — it is a cost of the parcel, not of the carriage. Folding it in pushed every quote into the ceiling and made differently-priced carriers look identical.

### Negotiation

```
Match created (proposed, initialFee = quoted delivery fee)
   │
   ▼
POST /api/matches/[id]/negotiate  { proposedFee, message }
   ├── rejected unless status is 'proposed'
   ├── rejected if expired
   ├── rejected unless the caller is the sender or the carrier
   ├── rejected if the caller already has the outstanding offer
   └── rejected if the fee exceeds the ceiling
   │
   ▼  (alternating, any number of rounds)
   │
POST /api/matches/[id]/accept
   └── rejected if you are accepting your own outstanding offer
```

The proposer is taken from the session, never from the request body — otherwise anyone could post offers as the other party.

---

## Payments and escrow

```
match accepted ──► payment created, escrowStatus: 'funded', parcel paymentStatus: 'paid'
                   │
                   ├── parcel marked delivered ──► escrow released to carrier
                   ├── PUT /api/payments release/refund
                   └── PUT /api/payments dispute ──► escrowStatus 'disputed', admin resolves
```

Escrow is modelled end to end and the state machine works. **No payment provider is wired up** — no funds move. `paymentMethod` records intent (`stripe`, `paypal`, `bank_transfer`, `crypto`); integrating a provider means implementing capture in `POST /api/payments` and settlement in the release branch of `PUT`.

---

## KYC and compliance

Three steps, at `/kyc`:

1. **Details** — personal info, address, contact, employment. Enforces 18+.
2. **Documents** — passport, driver's licence or national ID. Each type declares the images it needs (a passport needs a front and a selfie; a licence also needs the back), and upload is refused until they are all present. Expired documents are rejected.
3. **Verification** — runs risk scoring, compliance screening and document checks. Clean applications approve automatically and set `users.kycStatus` to `verified`; anything flagged goes to `/admin/kyc`.

### Risk scoring

| Factor | Points |
| --- | --- |
| Account under 30 days old | +20 |
| Address outside the primary market | +15 |
| Document rejected, expired, or missing | +30 |
| Parcels declared over $1,000 | +25 |
| Suspicious activity | +40 |

Bands: low 0–19, medium 20–34, high 35–49, very high 50+. Flagged at 35 and up.

### Screening

[`src/lib/kyc-service.js`](src/lib/kyc-service.js) holds the simulation behind the same interface a real provider would use:

- **Sanctions and PEP** — matched against stand-in watchlists. Deterministic, so the queue is stable and the flagged path is demonstrable. Swap the list for a provider call and nothing else changes.
- **AML** — behavioural rather than identity-based: high declared income with no employer is the pattern that draws review.
- **Documents** — face match, authenticity and liveness scores derived from what was actually uploaded, so results reflect the user's own input.

`canAutoApprove()` requires an unflagged risk score, clear results on all three compliance checks, and passes on all three document checks.

---

## Authentication and authorization

Routes declare the scope they need:

```js
export const GET = withAuth(['read:parcels'], async (req, { user }) => { … });
```

With Auth0 configured this requests a scoped access token and resolves the session user. Without it, the handler runs as the demo user. Either way the handler receives `ctx.user`, and `currentUser(db, ctx.user)` resolves the ParceFlyte profile.

| Resource | Read | Write |
| --- | --- | --- |
| Users | `read:users` | `write:users` |
| Parcels | `read:parcels` | `write:parcels` |
| Travels | `read:travels` | `write:travels` |
| Matches | `read:matches` | `write:matches` |
| Payments | `read:payments` | `write:payments` |
| Ratings | `read:ratings` | `write:ratings` |

Beyond scopes, routes enforce **ownership**: only a match's sender or carrier can negotiate, accept or reject it; only a parcel's sender can cancel it; only a travel's carrier can edit it. The admin nav appears only for users holding the `admin` role.

---

## Frontend architecture

**Session.** `SessionProvider` fetches `/api/session` once and exposes `useSession()` — `{ user, demoMode, loading, refresh }`. No component knows whether Auth0 is involved.

**Shell.** `AppShell` gives every signed-in page a sidebar, a mobile header with a slide-down nav, the demo banner with its reset control, and a consistent title/description/actions header.

**Data.** `useApi(url)` returns `{ data, loading, error, reload }` and ignores responses from superseded requests. `apiFetch` surfaces the API's own error message rather than a bare status, which is why validation failures read as sentences in the UI.

**Component tiers.** `components/ui/` primitives → `components/home/` marketing sections → feature components (`match-card`, `negotiation-modal`, `parcel-form`, `travel-form`, `score-badge`, `carrier-badge`, `route-line`, `empty-state`) → pages.

**Theming.** HSL custom properties in `globals.css` mapped to Tailwind tokens, including `success` and `warning`, so `statusVariant()` in [`format.js`](src/lib/format.js) can map any domain status to a badge variant in one place.

**Explaining the score.** `ScoreBadge` draws the 0–100 ring; `ScoreBreakdown` renders per-factor bars with weights. On a parcel page, **Why this score?** also opens the fee build-up, including how much the ceiling removed. A number the user cannot interrogate is a number they will not trust.

---

## Running against MongoDB and Auth0

Copy `.env.example` to `.env.local` and fill in what you need — they are independent.

### MongoDB

```env
MONGODB_URI=mongodb://localhost:27017/parceflyte
```

```bash
npm run seed   # loads the demo dataset and creates indexes
```

The seed drops existing collections, converts the 24-char hex ids to real `ObjectId`s, and creates the indexes the hot paths need — including `travels` on `{ status, departureDate }`, which serves the matching engine's pre-filter, and unique indexes on `users.auth0Id`, `payments.matchId` and the rating triple.

### Auth0

```env
AUTH0_SECRET=            # openssl rand -hex 32
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=https://api.parceflyte.com
```

Define the scopes above as permissions on the Auth0 API identified by `AUTH0_AUDIENCE`. Set the callback URL to `http://localhost:3000/api/auth/callback` and the logout URL to `http://localhost:3000`. All five of `AUTH0_SECRET`, `AUTH0_BASE_URL`, `AUTH0_ISSUER_BASE_URL`, `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` must be present, or the app stays on the demo session.

---

## Known gaps

Things that are deliberately unfinished, stated plainly:

- **No payment provider.** Escrow state transitions work; no money moves.
- **No document storage.** KYC uploads record a file name. Real uploads need object storage and encryption at rest.
- **Compliance screening is simulated.** Watchlists are local arrays. The interface is provider-shaped, so replacing it is contained to `kyc-service.js`.
- **No real-time messaging.** `matches.messages` exists in the schema but has no UI or endpoint; negotiation messages ride along with offers.
- **No tests.** No runner is configured. The scoring functions and the demo store's query matcher are the highest-value places to start — both are pure.
- **No email or SMS.** `communicationHistory` records that a notification would have been sent.
- **ESLint is not enforced at build time.** `next.config.mjs` sets `ignoreDuringBuilds: true`.
- **Demo state is per-process.** In-memory data does not survive a restart and is not shared across instances. That is fine for a demo, and is exactly why `MONGODB_URI` exists.

---

## License

MIT

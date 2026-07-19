# Kradəl Build Status Audit
**Date:** 2026-05-31 | **Auditor:** read-only codebase inspection | **No code changes made**

---

## 1. DONATION / CHECKOUT FLOW (Registers)

### Classification: FULLY BUILT — BLOCKED BY MISSING ENV KEYS

The full donation pipeline is implemented end-to-end in code but is **non-functional in the current deployment** because the Stripe environment variables are not set.

#### What exists

| Layer | File | Status |
|---|---|---|
| Fund panel UI | `src/app/registers/[id]/page.tsx` | Built — amount picker, quick-fill pills, contributor count |
| Stripe session creation | `src/app/api/registers/[id]/items/[itemId]/fund/route.ts` | Built |
| Stripe webhook handler | `src/app/api/webhooks/stripe/route.ts` | Built |
| Refund handler | `src/app/api/webhooks/stripe/route.ts` → `handleChargeRefunded` | Built |
| Idempotency guard | `prisma/schema.prisma` → `StripeEvent` model | Built |
| DB update on payment | `RegisterItemFunding`, `RegisterItem.totalFundedCents`, `User.totalFundedCents` | Built |
| Admin refunds | `src/app/api/admin/refunds/route.ts` | Built |

#### Stripe mode
The `.env.example` references `sk_test_...` / `pk_test_...` prefixes — test mode. However:
- **`STRIPE_SECRET_KEY` is NOT set in `.env`**
- **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is NOT set**
- **`STRIPE_WEBHOOK_SECRET` is NOT set**

The `getStripe()` helper throws if `STRIPE_SECRET_KEY` is absent. The fund endpoint catches this and returns HTTP 503 ("Payment service is unavailable"). Payments are **completely non-functional** in the current deployment.

#### Payment flow trace (when keys are set)
1. Donor picks amount → POST `/api/registers/[id]/items/[itemId]/fund`
2. A `RegisterItemFunding` row is created with `status: PENDING` and a `stripeSessionId`
3. Donor is redirected to Stripe Hosted Checkout (`session.url`)
4. On success, Stripe fires `checkout.session.completed` to `/api/webhooks/stripe`
5. Webhook confirms the funding row, increments `RegisterItem.totalFundedCents`, updates `User.totalFundedCents` and `fundingCount`, and determines new `fundingStatus` (PARTIAL → FULLY_FUNDED)
6. If fully funded: item moves to `AWAITING_ADDRESS` (ask-per-shipment) or `AWAITING_PURCHASE`/`IN_FULFILLMENT` (saved address), and notifications fire to donor + creator + prior co-funders
7. On payment cancel, Stripe fires `checkout.session.expired` → PENDING row deleted
8. Stale-session recovery is handled: re-visiting fund flow reuses open sessions, deletes expired ones

#### What is missing
- **No receipt/thank-you email** after a successful payment. `src/lib/email.ts` has `sendWelcomeEmail`, `sendBundleApproved`, etc., but no `sendDonorThankYou` or `sendPaymentReceipt` function. The webhook does send in-app notifications but no email.
- **No confirmation screen** beyond the toast triggered by `?payment=success` URL param on return to the register page. There is no dedicated `/payment/success` page.
- The `totalFundedCents` and `fundingStatus` fields are real DB columns that are genuinely zero-until-paid — the "raised" numbers shown in the UI are **not seeded or mocked**. The seed file creates one item with `status: "FULFILLED"` but no `totalFundedCents` value (defaults to 0).

---

## 2. CIRCLES

### Classification: FULLY FUNCTIONAL (community features) / PARTIALLY BUILT (coaching layer)

Circles is the most complete feature in the codebase. Real membership, posting, reactions, comments, moderation, and admin tools are all wired end-to-end.

#### Routes
- `src/app/circles/page.tsx` — entry point; auto-detects country via IP (`ipapi.co`), auto-joins a country circle, redirects to the user's stage circle
- `src/app/circles/[id]/page.tsx` — full circle experience (945 lines)
- `src/app/circles/all/page.tsx` — browse all circles

#### API endpoints
| Endpoint | Purpose |
|---|---|
| `GET/POST /api/circles/[id]/posts` | Paginated post feed + create |
| `GET /api/circles/[id]/stream` | Server-sent events for real-time new-post polling (SSE, 137 lines) |
| `GET/POST /api/circles/my` | User's active circle; auto-join country circle |
| `GET /api/circles/cohort` | Stage-based cohort circles |
| `GET /api/circles/stages` | Available stage circles |
| `GET/POST /api/circles/posts/[postId]` | Single post |
| `POST /api/circles/posts/[postId]/comments` | Add comment |
| `POST /api/circles/posts/[postId]/like` | Like/unlike |
| `POST /api/circles/posts/[postId]/react` | HEART/HUG/CLAP reactions |
| `POST /api/circles/posts/[postId]/report` | Report post |
| `GET /api/admin/circles` | Admin: list circles |
| `GET /api/admin/circles/flagged` | Admin: flagged posts queue |
| `POST /api/admin/circles/flagged/[id]` | Admin: approve/reject flagged post |
| `GET/PATCH /api/admin/circles/leaders` | Admin: promote/demote circle leaders |

#### Prisma models
`Circle`, `CircleMember` (with `isLeader`, `accessType: READ_COMMENT | FULL`), `CirclePost` (with `isPinned`, `isHidden`, `isIntroPost`, `photoUrl`), `CircleChannel`, `CircleReaction`, `PostLike`, `PostComment`, `FlaggedPost`

#### What works end-to-end
- Auto-join on first visit (country + stage circles)
- Post creation with category (TIP / STORY / GRATITUDE / QUESTION / SMALL_WIN / WORKING_ON)
- Photo upload via Cloudinary
- Channel-based sub-groups within a circle
- Real-time new-post SSE stream
- Reactions (HEART, HUG, CLAP) and likes
- Comments
- Report post → creates `FlaggedPost` for admin queue
- Admin: approve/reject flagged posts, promote circle leaders
- 3-post-per-day cap; URL link blocking; minimum post-length validation
- `circleFilter.ts`: keyword blocklist prevents solicitation ("need diapers", "can anyone donate", etc.)
- Donor-access gate: donors cannot view or post

#### What is missing / partial
- **No crisis/mental health resources** are surfaced inside the circle UI itself. A basic "safe space" notice appears in the UI copy, and a `PostComment` mentions community guidelines. A crisis resource link (Crisis Services Canada, 1-833-456-4566) exists only inside `src/app/journey/page.tsx` — it is not shown in the circles space where it would be most relevant.
- **No direct messaging** between circle members. `/chat` page redirects to `/pickups` — there is no peer DM feature.
- **The "coach" role** is represented only as `isLeader: true` on `CircleMember`. There is no dedicated coach persona, coaching schedule, or moderation queue for peer-support escalation. Leaders can pin posts and have a visual badge, but there is no formal escalation path from member → leader → staff.
- **No stage-graduation** automation. `graduatedCircleIds` field exists on User but no cron job or trigger moves users between stage circles when their stage advances.

---

## 3. DISCOVER (/browse)

### Classification: FULLY FUNCTIONAL (core flow) / PARTIALLY BUILT (post-handoff)

The Discover tab is the peer-to-peer item listing and claim flow. The full path from listing → claiming → coordination → physical handoff → confirmation is built and wired.

#### Routes
- `src/app/browse/page.tsx` — item browse with search, category filter, condition filter
- `src/app/items/[id]/page.tsx` — item detail
- `src/app/coordination/[requestId]/page.tsx` — full coordination thread (945 lines)
- `src/app/pickups/page.tsx` — active/completed/cancelled pickups tracker

#### API endpoints
| Endpoint | Purpose |
|---|---|
| `GET /api/items` | Browse items (with trust-score-based ranking) |
| `GET/PATCH/DELETE /api/items/[id]` | Item detail, edit, mark unavailable |
| `POST /api/items/[id]/favourite` | Favourite toggle |
| `GET /api/items/cities` | City filter list |
| `GET /api/items/trust-stats` | Trust percentile stats |
| `GET/POST /api/requests` | Claim an item (create request) |
| `PATCH /api/requests/[id]` | Accept/decline a claim |
| `POST /api/requests/[id]/fulfill` | Mark item as handed over |
| `POST /api/requests/[id]/fulfillment/confirm` | Recipient confirms receipt |
| `GET /api/coordination/[requestId]` | Coordination thread |
| `POST /api/coordination/[requestId]/confirm-location` | Set pickup location |
| `POST /api/coordination/[requestId]/propose-time` | Propose time |
| `POST /api/coordination/[requestId]/confirm-time` | Confirm time |
| `POST /api/coordination/[requestId]/ready` | Donor marks ready |
| `POST /api/coordination/[requestId]/delivered` | Donor marks delivered |
| `POST /api/coordination/[requestId]/confirm-received` | Recipient confirms receipt |
| `POST /api/coordination/[requestId]/cancel` | Cancel coordination |
| `POST /api/coordination/[requestId]/report` | Report coordination |
| `GET/POST /api/coordination/[requestId]/messages` | Messaging thread |
| `GET /api/pickups` | User's active pickups |

#### Prisma models
`Item`, `Request`, `PickupCoordination`, `CoordinationMessage`, `CoordinationReport`, `FulfillmentLog`, `Review`, `Favourite`

#### What works end-to-end
- Listing an item (with photos via Cloudinary, category, condition, urgency flag)
- Browsing items with trust-score-based ranking (verified donors surface first)
- Claiming an item via request; donor accepts/declines
- Full coordination thread: location confirm → time proposal → confirm → donor ready → delivered → recipient confirms received
- In-thread messaging (text + images)
- Abuse checks run at claim creation (`runAbuseChecks`)
- Access gate: `canClaimDiscoverItem` (verification level check in `src/lib/access.ts`)
- Report coordination for admin review

#### What is missing / partial
- **No post-handoff review prompt.** The `Review` Prisma model exists (`pickupRating`, `qualityRating`, `quantityRating`, `comment`) and `src/components/RequestReviewSheet.tsx` exists, but there is no API endpoint at `POST /api/reviews` that persists review data — the review sheet is a UI-only component without a working backend.
- **No email notifications** in the coordination flow — only in-app notifications.
- **Map view is stubbed.** The browse page has a `viewMode` toggle ("list" | "map") but the map view renders an empty placeholder (no mapping library integrated).

---

## 4. QUICK SCAN

### Old verification field references

Three fields from an older verification system remain active in the schema and are widely used:

| Field | In schema? | Files referencing it |
|---|---|---|
| `verificationLevel` | Yes — `User.verificationLevel Int @default(0)` | **35 files** |
| `trustScore` | Yes — `User.trustScore Int @default(0)` | **27 files** |
| `docStatus` | Yes — `User.docStatus DocStatus @default(UNVERIFIED)` | **11 files** |

These are not dead — `verificationLevel` is the active gate for claiming items (Discover) and is exposed in auth tokens. `trustScore` drives circle post ranking and item sort order. `docStatus` is used in onboarding and admin verification flows. All three coexist with the newer `identityVerified` / `manualReviewStatus` / `personaStatus` fields added in recent migrations.

Key files: `src/app/api/auth/login`, `src/app/api/auth/me`, `src/app/api/items/route.ts`, `src/app/api/requests/route.ts`, `src/lib/trust.ts`, `src/lib/abuse.ts`, `src/contexts/AuthContext.tsx`, `src/components/VerificationBanner.tsx`, `src/app/admin/page.tsx`, `src/app/api/admin/users/[id]/route.ts`, `src/app/api/admin/verification/route.ts`.

### Privacy Policy

**EXISTS.** `src/app/privacy/page.tsx` — a full React page that reads from a Markdown file and renders it with `react-markdown` + GFM. A table-of-contents component (`PrivacyToc.tsx`) is also present.

### Terms of Service

**MISSING.** No `/terms` route exists anywhere in the app. There is no `/terms/page.tsx` and no Terms model or content file. A ToS link in the registration flow would currently go nowhere.

### Seed accounts with weak passwords

**YES — confirmed risk if seed has been run against the production database.**

`prisma/seed.ts` creates the following accounts, all with `bcrypt.hash("password123", 12)`:
- `amara@carecircle.ng`
- `fatima@carecircle.ng`
- `grace@carecircle.ng`
- `kemi@carecircle.ng`
- `sandra@carecircle.ng`
- `titi@carecircle.ng`
- `ngozi@carecircle.ng` (seeded as a circle leader)
- `chioma@carecircle.ng` (seeded as a circle leader)
- `reviewer@carecircle.ng`

`"password123"` is on the blocked-password list in `src/lib/password.ts`, so these accounts **cannot be created through the normal registration flow** — but the seed script calls Prisma directly and bypasses that check.

**Action required:** Confirm whether the seed has ever been run against the Neon production database. If so, delete these accounts or force-reset their passwords immediately.

### Bundles tab

**Classification: FULLY FUNCTIONAL**

The Bundles flow is complete: catalogue browsing → application form → admin review → approval notification → shipping notification.

- `src/app/bundles/page.tsx` — full catalogue, application form (story, address, stage, due date), monthly slot tracking, per-applicant lock-out while under review
- `GET /api/bundles/catalogue` — fetches active bundles with slot counts
- `POST /api/bundles/apply` — creates `BundleApplication` with address, story, stage
- `GET/PATCH /api/admin/bundles/applications` — admin review queue
- `POST /api/admin/bundles/applications/[id]` — admin approve/deny (triggers Resend email via `sendBundleApproved` / `sendBundleShipped`)
- Prisma models: `Bundle`, `BundleApplication`, `BundleAddress`
- Access gate: `canApplyForBundle` checks `identityVerified`, `manualReviewStatus`, `accountHold`
- **Missing:** No Stripe payment — bundles are funded by the platform, not donors, so no checkout is needed or expected.

### Pickups tab

**Classification: FULLY FUNCTIONAL**

The Pickups tab is the management surface for active Discover coordination threads. It is not a standalone feature — it shows all coordination records where the user is donor or recipient.

- `src/app/pickups/page.tsx` — lists active/completed/cancelled pickups with status badges, last-message preview, and links to each coordination thread
- `GET /api/pickups` — queries `PickupCoordination` for all of the user's threads
- Each pickup card links to `/coordination/[requestId]` — the full coordination page with messaging, location, time scheduling, delivery confirmation
- `/chat` redirects to `/pickups`
- **Fully functional.** The only partial element is that reviews (`RequestReviewSheet` component) exist in the UI but the backend `/api/reviews` endpoint is absent (see Discover section above).

---

## Summary Table

| Feature | Status | Key Gap |
|---|---|---|
| Donation / Checkout (Registers) | Built, **non-functional** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` not set in `.env` |
| Circles — community | Fully functional | — |
| Circles — coaching/crisis | Partially built | No crisis resources in circle UI; no DM; `isLeader` only, no formal escalation path |
| Discover — list/browse/claim | Fully functional | — |
| Discover — coordination/handoff | Fully functional | — |
| Discover — reviews | Stub | `ReviewSheet` UI exists; no `/api/reviews` backend |
| Bundles | Fully functional | — |
| Pickups | Fully functional | — |
| Privacy Policy | Exists | — |
| Terms of Service | **Missing** | No page, no content |
| Seed accounts | **Risk** | 9 accounts with `password123`; confirm not in prod DB |
| Donation receipt email | Missing | No `sendDonorThankYou`/`sendPaymentReceipt` in `src/lib/email.ts` |
| Map view (Discover) | Stub | Toggle present, no map library wired |

---

## Investigation A — Seed Accounts on the Production Database

**Investigated:** 2026-05-31 | Read-only SELECT query only — no deletions performed.

### The 9 seed account emails (`password123`)

From `prisma/seed.ts`:
1. `amara@carecircle.ng` — DONOR
2. `fatima@carecircle.ng` — DONOR
3. `grace@carecircle.ng` — DONOR
4. `kemi@carecircle.ng` — DONOR
5. `sandra@carecircle.ng` — DONOR
6. `titi@carecircle.ng` — DONOR
7. `ngozi@carecircle.ng` — RECIPIENT (seeded circle leader)
8. `chioma@carecircle.ng` — RECIPIENT (seeded circle leader)
9. `reviewer@carecircle.ng` — RECIPIENT

### Which database was checked

`DATABASE_URL` points to: `ep-bold-breeze-ampnforo-pooler.c-5.us-east-1.aws.neon.tech` — this is the **Neon production instance** (the same host used for all `prisma migrate deploy` runs throughout this project).

### Query result

A `SELECT` against `"User" WHERE email IN (...)` returned **7 of the 9 accounts**:

| Email | Role | Status | Created |
|---|---|---|---|
| `amara@carecircle.ng` | DONOR | ACTIVE | 2026-04-05 |
| `fatima@carecircle.ng` | DONOR | ACTIVE | 2026-04-05 |
| `grace@carecircle.ng` | DONOR | ACTIVE | 2026-04-05 |
| `kemi@carecircle.ng` | DONOR | ACTIVE | 2026-04-05 |
| `sandra@carecircle.ng` | DONOR | ACTIVE | 2026-04-05 |
| `titi@carecircle.ng` | DONOR | ACTIVE | 2026-04-05 |
| `reviewer@carecircle.ng` | RECIPIENT | ACTIVE | 2026-04-05 |

**Not found:** `ngozi@carecircle.ng` and `chioma@carecircle.ng` (the two seeded RECIPIENT / circle-leader accounts).

### Verdict

**7 seed accounts with the password `password123` exist in the production Neon database.** All are `status: ACTIVE`. The 6 DONOR accounts were created on 2026-04-05, suggesting the seed script was run shortly after the database was provisioned.

`"password123"` is on the blocked list in `src/lib/password.ts`, so these cannot be used to register new accounts — but the seed bypassed that check by writing directly via Prisma. Any attacker who knows these emails (they are not obscure) and tries `password123` will get in.

**Immediate action required:** Delete or suspend all 7 accounts, or force-rotate their passwords before any public-facing launch.

---

## Investigation B — Which Verification System Actually Gates Access?

**Investigated:** 2026-05-31 | Read-only source inspection.

### Access gates in `src/lib/access.ts`

All four capability checks in `access.ts` read **only new-system fields**:

| Function | Fields read | Old fields used? |
|---|---|---|
| `canCreateRegister` | `manualReviewStatus` | No |
| `canApplyForBundle` | `identityVerified`, `accountHold` | No |
| `canReceiveShipment` | `identityVerified`, `accountHold` | No |
| `canClaimDiscoverItem` | `manualReviewStatus`, `identityVerified`, `accountHold` | No |

These four functions are the sole enforcement points for all meaningful user-facing capabilities (register creation, bundle application, address confirmation, item claiming). Old fields play no role here.

### The one borderline case: Layer 1 bypass in `requests/route.ts`

`src/app/api/requests/route.ts` lines 75–80 contain:

```typescript
const isFullyVerified = (requester.verificationLevel ?? 0) >= 2;
if (!isFullyVerified && (!(requester.phoneVerified || requester.emailVerified) || !requester.avatar)) {
  return /* LAYER1_INCOMPLETE — 403 */;
}
```

This uses `verificationLevel >= 2` to bypass the Layer 1 profile-completeness requirement (phone/email verified + avatar). **This is technically load-bearing code.** However:

1. `verificationLevel = 2` is set only when both `phoneVerified = true` AND `emailVerified = true` (set in `confirm-otp/route.ts` and `phone-setup/route.ts`).
2. With both of those true, `phoneVerified || emailVerified` is already true — so the Layer 1 check passes naturally regardless of the bypass.
3. The only way this bypass matters is if an admin manually sets `verificationLevel = 2` without the underlying phone/email fields — but the admin `manualVerify` action in `admin/users/[id]/route.ts` sets all three together (`phoneVerified: true`, `emailVerified: true`, `verificationLevel: 2`).

**The bypass branch is dead in all reachable states.** It cannot grant access to anyone who would otherwise be blocked.

Critically, after the Layer 1 check, `canClaimDiscoverItem` always runs — and that function requires `manualReviewStatus === "APPROVED"` (first claim) or `identityVerified === true` (subsequent claims). A user who somehow passed Layer 1 via the bypass would still be blocked here.

### Other old-field uses — all non-access

| Use | File | Effect |
|---|---|---|
| `verificationLevel >= 2` adds +20 to sort score | `items/route.ts` | Affects listing **rank**, not access |
| `verificationLevel >= 2` → `isVerified: true` | `journey/route.ts` | Display field returned to client |
| `trustScore` passed to `logAbuseEvent` | multiple | **Logging only** |
| `trustScore` drives abuse-check scoring | `abuse.ts` | Abuse detection, not access gate |
| `docStatus === "VERIFIED"` | admin pages | **Display and admin queue filter only** |
| `verificationLevel` in auth token | `login/route.ts`, `me/route.ts` | Sent to client for UI display |
| `verificationLevel >= 1` for "Verified" badge | UI pages | **Visual indicator only** |

### The admin `manualVerify` gap (correctness bug, not security risk)

`admin/users/[id]/route.ts` `manualVerify` action sets: `verificationLevel: 2`, `docStatus: "VERIFIED"`, `phoneVerified: true`, `emailVerified: true`, `onboardingComplete: true`. It does **not** set `manualReviewStatus = "APPROVED"` or `identityVerified = true`.

This means a user "manually verified" by an admin cannot create a register (needs `manualReviewStatus`), cannot claim their first Discover item (needs `manualReviewStatus === "APPROVED"`), and cannot apply for bundles (needs `identityVerified`). The old fields are set but the new gates remain closed. This is a functional bug — not a security gap.

### Verdict

> **Old system is referenced but the new system (`manualReviewStatus` / `identityVerified` / `accountHold`) is the sole effective access gate — cleanup only, no security risk.**
>
> The one technically live reference (`verificationLevel >= 2` Layer 1 bypass in `requests/route.ts`) is dead in all reachable states and cannot independently grant capability access. All old-field usage outside `access.ts` is display, logging, sort-ranking, or the admin manual-verify gap (which under-unlocks, not over-unlocks).
>
> **Secondary action recommended:** The admin `manualVerify` action should also set `manualReviewStatus = "APPROVED"` and `identityVerified = true` to actually unlock capabilities for manually-verified users.

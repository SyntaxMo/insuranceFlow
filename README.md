# InsureFlow

Professional motor insurance claim intake application built with Next.js and Supabase.

## Overview

InsureFlow lets customers:

1. Verify an active motor policy
2. Enter accident details
3. Attach supporting documents
4. Review and submit a claim
5. Receive a claim number pending review

Admins can browse submitted claims and open claim detail pages.

**Supabase database configuration, RLS, policies, and storage setup are managed separately by you.** This repository only contains the application code.

**AI-assisted document extraction and claim analysis will be added in the next phase.**

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- `@supabase/supabase-js`

Prisma is intentionally not used.

## Security architecture

Sensitive table access happens **only on the server** with `SUPABASE_SERVICE_ROLE_KEY`:

- policy verification
- vehicle lookup
- claim creation
- claim document records
- admin claims list/detail
- private storage uploads and signed URLs

The browser calls Next.js API routes / server-rendered admin pages. It does **not** query `users`, `vehicles`, `policies`, `claims`, or `claim_documents` with the anon key.

`src/lib/supabase/server.ts` imports `server-only` so it cannot be pulled into Client Components.

The anon key (`src/lib/supabase/client.ts`) is reserved for browser-safe operations only.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/claim` | Multi-step claim intake |
| `/claim/success` | Submission confirmation |
| `/admin/claims` | Claims list (server-side service role) |
| `/admin/claims/[id]` | Claim detail + signed document URLs |
| `POST /api/policies/verify` | Policy verification |
| `POST /api/claims` | Claim submission + private storage uploads |

## Claim flow

1. **Policy verification** – server looks up policy, requires `ACTIVE` + in-force dates
2. **Accident details** – date, location, description, email, phone
3. **Documents** – police report (optional), repair estimate (required), accident photos (one or more)
4. **Review** – confirm details
5. **Submit** – server re-verifies policy, inserts claim (`SUBMITTED`), uploads to private `claim-documents` bucket, writes `claim_documents`, returns claim number

Test policy number: **`MOT-2026-0001`**

## How Supabase is connected

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=claim-documents
SUPABASE_SERVICE_ROLE_KEY=
```

Helpers:

- `src/lib/supabase/client.ts` – browser anon client (not used for sensitive tables)
- `src/lib/supabase/server.ts` – **required** service-role client for sensitive operations

Existing schema used by the app:

- **policies**: `id`, `user_id`, `vehicle_id`, `policy_number`, `status`, `start_date`, `end_date`, `coverage_type`, `excess_amount`, `coverage_limit`
- **vehicles**: `id`, `owner_id`, `make`, `model`, `year`, `plate_number`
- **claims**: `id`, `policy_id`, `claim_number`, `accident_date`, `accident_location`, `description`, `contact_email`, `contact_phone`, `status`, `created_at`
- **claim_documents**: `id`, `claim_id`, `document_type`, `file_name`, `file_path`

Storage bucket: private `claim-documents` (already exists).

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run lint
npm run build
npm run test
```

## Current limitations

- No end-user / admin authentication UI yet (admin pages are reachable without login)
- Claim numbers are generated application-side as `CLM-YYYY-####`
- Document AI extraction / claim analysis is not included yet

## Supabase configuration managed by you

This app does **not** create projects, tables, buckets, or RLS policies, and it does **not** require granting sensitive tables to `anon`.

Service role is used server-side. Keep RLS restrictive for `anon` / browser access.

# InsureFlow account/privacy UI contract

Scope: the approved Settings and bounded ADMIN refinement, October 2, 2026.
This records existing and approved UI behavior, not a new product policy.

## Business-context sources

The user's approved refinement and schema confirmations are authoritative for this
slice. Implementation evidence lives in `src/lib/auth/session.ts`, `src/lib/auth/admin.ts`,
`src/app/dashboard/profile/deletion-actions.ts` and `src/app/admin/management-actions.ts`.
Privacy wording is in `src/app/privacy/page.tsx`. Destructive processing remains an
unapproved proposal in `docs/data-deletion-processing-plan.md`.

## Visual contract and canonical owners

See `DESIGN.md`; runtime CSS and existing shared components remain canonical.
Forms: `components/ui/Forms.tsx`. Menus: `components/layout/AccountMenu.tsx`.
Password flow: `components/profile/ChangePasswordControl.tsx` and existing actions.
Deletion flow: `components/profile/DataDeletionControl.tsx` and customer actions.
Dialog accessibility: `lib/accessibility/focus.ts`. Admin management confirmations
use the same helpers and existing visual conventions, not another framework.

## Navigation and datasets

Customer Profile/Settings/Sign out remain separate account actions. Settings owns
password and deletion controls; Profile owns identity/activity. ADMIN overview links
to deletion requests and Claims Officers; officers retain their Claims route.
Staff account profile and password remain organization-managed except password.
Admin lists use 25-record, server-side, URL `page` pagination with stable ordering.
Empty/error states are explicit; narrow tables scroll horizontally with full values.
Each new route has a non-PII document title and uses the existing root main landmark.

## Operation feedback and focus

| Operation | Pending | Success | Failure/focus |
| --- | --- | --- | --- |
| Request submission | Existing dialog disables repeat submission | Receipt and Settings status; email is best effort | Fields preserved; safe error; customer remains active |
| Customer cancellation | Explicit confirmation, pending-only mutation | Cancelled status; Settings refreshed | Stale state rejected; dialog remains usable |
| ADMIN transition | Confirmation and source-state compare-and-set | In-dialog result; list refreshed | Safe error; existing modal focus helpers |
| Staff identity update | Explicit organization-managed address confirmation | Updated list and result; no password/role mutation | Validation values preserved; first invalid field focused |

ADMIN action dialogs survive row revalidation so success can be read. After Done,
restore the initiating control if it exists, otherwise the neutral request action
group (programmatic focus only). Never trigger a different action through focus.
Background is isolated; Escape cannot dismiss pending work or trigger mutations.

## Security consequences in UI

Only CUSTOMER sees customer Settings actions; only ADMIN sees management controls.
Server authorization is authoritative. Staff target profile references are resolved
to Auth mappings server-side and rechecked as CLAIMS_OFFICER. No Auth ID, password,
role selector or impersonation control is rendered. Work-email reassignment is explicit
and immediate, using Auth first; a failed profile mirror is safely reported and repaired
from trusted Auth on a later authenticated request. Public full name remains authoritative.

Request status is metadata only. Completion explicitly states that no data was deleted.
Customer cancellation is available only while pending. New submissions check both active
states and are backed by the applied unique index. Status text never relies on color.
Email links go through `/login?next=settings`, an allowlisted return destination, and
never mutate on GET. Signed-in customers skip the form; staff retain their role route.

## Async, validation and secrets

Mutations are pessimistic. Source-status checks reject stale transitions; disabled
controls prevent accidental repeat submission. App and server validation are both
retained. Inline errors use shared Field associations; important results use status/alert
regions. No optional field is made required. No credentials/challenges are added to
URLs, logs, browser persistence or administrative DTOs. Existing password OTP security
and recovery remain unchanged. No autosave, bulk deletion or destructive worker exists.

## Verification

Run TypeScript, ESLint, Vitest, production build and git diff --check. Focused tests
cover access, transitions, active duplicates, cancellation, DTO minimization, staff
identity sync failures, navigation return and dialog keyboard behavior. Live schema
inspection is read-only. Browser credentialed/admin and real email workflows require
an existing authorized session; automated mocks do not prove live email delivery.

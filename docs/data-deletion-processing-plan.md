# Proposed deletion/anonymization processing plan

Status: proposal only, October 2, 2026. **Not approved or implemented.**

The administration UI can mark request metadata completed, but it does not erase
data. Its confirmation and customer status explicitly distinguish those actions.
Any destructive worker, schema/policy change, or migration needs separate approval.
This demonstration does not establish a statutory retention or deletion process.

## Verified relationship audit

Read-only inspection of the current Supabase catalog confirmed:

- `users.auth_user_id` references `auth.users` with `ON DELETE CASCADE` and is nullable.
- `vehicles.owner_id` and `policies.user_id` cascade from `users`.
- `policies.vehicle_id` cascades from `vehicles`; `claims.policy_id` cascades from policies.
- Claim documents, AI analyses, and status history cascade from claims.
- History actor references use `ON DELETE SET NULL` when a profile is removed.
- Policy documents cascade from policies.
- Customer policy links and policy-link verifications cascade from their policy
  and customer references. Password verifications reference both profile and Auth.
- Deletion requests reference users with `ON DELETE RESTRICT`.
- Legacy `admin_users` and `admin_sessions` reference Auth with cascading deletion.
- `intake_requests.claim_id` has no foreign key; these references need explicit review.
- `rate_limits` has no user foreign key; do not infer ownership from unrelated buckets.
- Both document buckets are private. Database-row deletion alone does not establish
  that the corresponding Storage objects were removed.

**Never start by deleting the Auth account or profile.** That can fail because of
the request restriction or cascade into insurance history and other linked data.

## Proposed decision matrix

| Category | Proposed treatment | Approval/detail needed |
| --- | --- | --- |
| Auth account | Revoke sessions/disable access at the approved processing point; remove only after confirmation email and safe profile detachment | Exact provider operations and retry ordering |
| Profile | Retain a pseudonymous relational anchor; clear phone and replace name/email with non-identifying, unique placeholders; detach Auth mapping before Auth removal | Approved placeholder format and SQL |
| Owned vehicles | Retain only required vehicle/coverage context; remove VIN/plate and other identifying values | Review uniqueness/format constraints before migration |
| Policies/claims | Retain references, coverage and workflow history only where needed for the demo; redact contact details, narrative/location and free text containing identity | Decide required historical fields; no blanket claim of anonymization |
| Claim AI analysis | Remove evidence-derived personal facts and free-text summaries; delete analysis content if reliable redaction is not possible | Decide whether any structured non-identifying results need retention |
| Status history | Keep action/status/time where needed; anonymize displayed actors and inspect notes for personal information | Shared staff history must not be erased indiscriminately |
| Verification records | Remove the requesting customer's password/policy-link challenges and destination email/hash records | Exact scoped cleanup and retry behavior |
| Customer policy links | Remove links belonging to the requesting portal customer | Linked policies owned by another person must not be deleted |
| Intake/idempotency records | Review and remove references only for affected claims, if no longer needed | No FK; explicitly enumerate safely |
| Deletion request | Keep minimal lifecycle metadata tied to the pseudonymous anchor; remove personal content from reason/resolution notes | Approved retention and maintenance rules |
| Rate-limit/legacy session records | Remove only conclusively identified account-related records; otherwise use existing expiry/maintenance | Audit key construction; no broad cleanup or table drop |

No fixed retention schedule is proposed here. Retention decisions must be explicit
before implementation, and remaining records must be reviewed for re-identification.

## Private files

Build a server-side manifest from authorized relationships before modifying records:
claim evidence and generated policy PDFs for policies actually owned by the requesting
customer. A link to somebody else's policy is not ownership. Review additional evidence,
generated PDFs, and possible orphan uploads. Use the Storage API to remove the approved
objects; do not merely delete `storage.objects` rows or database path records. Record
minimal completion/retry metadata without copying file content or signed URLs.

Existing emails and downloaded files cannot be recalled. Policy PDFs may already have
been sent as attachments, and uploaded evidence may itself contain sensitive data.

## Auth, email, ordering and failures

1. ADMIN authorization and a server-side PROCESSING-state check gate an approved worker.
2. Create a minimal, scoped processing manifest; do not copy whole customer records.
3. Send any approved completion notification to the existing email **before** removing
   the final address. State truthfully what was processed and retained, not that all
   data was erased if historical records remain. Define delivery-failure handling first.
4. Revoke/disable account access at the agreed stage, then perform approved storage
   cleanup and field-level anonymization with retry-safe checks.
5. Null the profile's Auth mapping before removing Auth, avoiding the live cascade.
   Preserve the profile anchor needed by the request and retained insurance references.
6. Verify scoped results and remaining references before recording actual completion.
   Never mark destructive processing successful merely because one API call succeeded.

Auth, Storage and database writes are not one atomic transaction. A future implementation
needs resumable processing, failure visibility and idempotency; request status alone is
not sufficient evidence of complete erasure. Additional persistence or SQL, if needed,
must be proposed at a separate schema checkpoint, not silently added.

## Approval required

Approve the delete/anonymize/retain decisions, field constraints, file ownership rules,
notification timing, recovery/retry behavior and retention first. Only then design the
exact implementation/migration and its security tests. No destructive SQL or execution
is included in this proposal.

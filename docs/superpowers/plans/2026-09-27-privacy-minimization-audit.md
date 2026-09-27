# InsureFlow privacy minimization audit plan

**Goal:** Audit every personal-data boundary, make only clearly safe code-level reductions, and document schema/policy decisions without applying them.

## 1. Inventory and trace

- Map form inputs to their validation, persistence, rendering, email, and external-provider use.
- Map every application table and sensitive field to known readers/writers from source and migrations.
- Inventory browser storage, private document delivery, server responses, logs, and third-party integrations.

## 2. Protect privacy boundaries with focused tests

- Add a claim-analysis request test proving account and business identifiers that are not needed for reasoning are absent from the OpenRouter prompt.
- Add a coverage-assistant request test proving identity/session fields are absent.
- Add focused sanitization tests proving raw provider/database error content is not included in operational diagnostics.
- Extend existing verification/storage tests only where they exercise an actual application privacy boundary.

## 3. Implement safe minimization

- Remove unnecessary claim, policy, and plate identifiers from claim-AI prompt text.
- Replace raw exception/provider/database logging with bounded, non-content diagnostics.
- Remove internal identifiers from routine operational logs where they are not needed.
- Tighten database selections and browser-facing DTOs only where the UI demonstrably does not consume the fields.
- Preserve required insurance data, private evidence access, claim workflow, authentication, and transactional notifications.

## 4. Verify and report

- Run focused tests during implementation, then TypeScript, ESLint, relevant auth/claims/AI/policy/privacy suites, production build, and `git diff --check`.
- Report exact retained data, external sharing, remaining inherent risks, legal-policy mismatches, and any schema/RLS/storage recommendations held for approval.

No database, RLS, bucket-policy, destructive cleanup, or legal-policy rewrite is included.

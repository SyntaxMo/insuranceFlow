# Password recovery validation

Recovery is separate from authenticated Profile password changes. Supabase sends
the recovery email and owns password updates. No reset tokens or passwords are
stored in application tables.

## Deployment check

- Keep `NEXT_PUBLIC_SITE_URL` set to the deployment's HTTPS origin.
- In Supabase Authentication → URL Configuration → Redirect URLs, ensure the
  configured origin's `/auth/callback?intent=recovery` is allowed (or covered by
  the existing callback allowlist). No dashboard settings were changed by this task.
- The Reset Password Auth email should retain the standard `{{ .ConfirmationURL }}`
  link. If it uses a custom token-hash link, send it to the existing `/auth/confirm`
  route with `token_hash={{ .TokenHash }}` and `type=recovery`.
- Recovery authorization uses the existing server-only `OTP_HASH_SECRET`, with a
  distinct HMAC purpose. The signed HttpOnly cookie expires after 15 minutes and
  is bound to the verified Auth user and session. It is removed on success.

## Manual inbox test

1. Open Sign in → Forgot password. Request a link for an accessible test account.
2. Check the generic acknowledgement; unknown emails must receive the same UI.
3. Open the emailed link in the requesting browser for PKCE recovery.
4. Confirm the new-password form appears; mismatch must preserve both values.
5. The tester enters and submits the new password themselves.
6. Confirm “Password updated”, return to sign in, and verify the new password.
7. Repeat with a claims-staff test account; role and profile data must remain unchanged.
8. Check an expired/reused link and direct `/reset-password` visits show a safe
   unavailable state. A normal login session must not authorize the reset action.

Live email delivery and real credential changes require this manual test; mocked
provider tests do not prove SMTP delivery or project allowlist configuration.

# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities through GitHub's Security Advisory feature:
[https://github.com/paperclipai/paperclip/security/advisories/new](https://github.com/paperclipai/paperclip/security/advisories/new)

Do not open public issues for security vulnerabilities.

## Password Recovery Deployment

Authenticated deployments use Better Auth's one-time password-reset flow. Reset
tokens expire after 15 minutes, are consumed once, and revoke the user's prior
sessions after a successful password change. Recovery requests are limited to
three per IP per minute and always return account-neutral wording.

SimOne's production email rail uses Resend when both `RESEND_API_KEY` and
`SIMONE_PASSWORD_RESET_FROM` are configured on the server. Keep the key in the
protected host environment; never commit it or place it in CI output. Provider
response bodies, recipient addresses, passwords, and reset URLs must not be
logged.

If email delivery is not configured, the endpoint preserves the same generic
response but sends no email. Private-alpha operators must then use the existing
single-account administrator-assisted credential rotation, invalidate prior
sessions, transfer the temporary credential directly to the account owner once,
and rotate it before access expands. Do not expose reset tokens in an operator
UI or logs as a substitute for email delivery.

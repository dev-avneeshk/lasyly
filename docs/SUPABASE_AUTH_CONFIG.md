# Supabase Authentication Configuration

This document lists the Supabase dashboard settings that must be configured manually to enforce the security requirements for authentication and session management (Requirements 5.1–5.8).

## Dashboard Settings (Supabase Project → Authentication → Settings)

### 1. JWT / Access Token Expiry

- **Setting**: Authentication → Settings → General → JWT Expiry
- **Value**: `900` (15 minutes / 900 seconds)
- **Requirement**: 5.2 — Access tokens with maximum lifetime of 15 minutes

Short-lived access tokens limit the window of exposure if a token is stolen. The client will automatically use the refresh token to obtain a new access token when the current one expires.

### 2. Refresh Token Rotation

- **Setting**: Authentication → Settings → Sessions → Refresh Token Rotation
- **Value**: Enabled
- **Requirement**: 5.1, 5.7 — Token rotation on authentication and refresh token rotation

When enabled, each time a refresh token is used to obtain a new access token, Supabase issues a new refresh token and invalidates the previous one. This prevents replay attacks with stolen refresh tokens.

### 3. Refresh Token Reuse Interval

- **Setting**: Authentication → Settings → Sessions → Reuse Interval
- **Value**: `0` seconds (no reuse window — immediate invalidation)
- **Requirement**: 5.7 — New refresh token issued, previous invalidated

Setting this to 0 means the old refresh token is immediately invalid after rotation. A small window (e.g., 10 seconds) can be set if network latency causes issues, but 0 is the most secure.

### 4. Session Lifetime (Refresh Token Expiry)

- **Setting**: Authentication → Settings → Sessions → Time-box user sessions
- **Value**: `604800` seconds (7 days)
- **Requirement**: 5.2 — Refresh tokens with maximum lifetime of 7 days

After 7 days without activity, the user must re-authenticate. This limits the lifetime of a compromised refresh token.

### 5. PKCE for OAuth Flows

- **Setting**: Enabled by default in Supabase Auth v2+ when using `@supabase/ssr`
- **Code Configuration**: `flowType: 'pkce'` in client options
- **Requirement**: 5.5 — PKCE for all OAuth authorization code flows

PKCE (Proof Key for Code Exchange) prevents authorization code interception attacks. The `@supabase/ssr` library handles the code verifier/challenge automatically when `flowType: 'pkce'` is set.

### 6. Inactivity Timeout (Optional)

- **Setting**: Authentication → Settings → Sessions → Inactivity Timeout
- **Value**: `3600` seconds (1 hour) — recommended
- **Requirement**: Supports 5.4 — Session invalidation

If the user is inactive for this duration, their session is invalidated server-side.

## Code-Level Configuration

The following settings are enforced in the application code:

### Cookie Security (`lib/supabase/auth-config.ts`)

| Attribute   | Value                                      | Requirement |
|-------------|-------------------------------------------|-------------|
| `httpOnly`  | `true`                                    | 5.3         |
| `secure`    | `true` in production                      | 5.3         |
| `sameSite`  | `strict`                                  | 5.3         |
| `path`      | `/`                                       | —           |

### PKCE Flow Type

All Supabase clients (browser, server, middleware) are configured with:

```typescript
auth: {
  flowType: 'pkce',
}
```

This ensures the OAuth callback uses PKCE code exchange rather than the implicit flow.

### Token Rotation

Token rotation is handled automatically by Supabase when:
1. **Refresh Token Rotation** is enabled in the dashboard
2. The middleware calls `supabase.auth.getUser()` which triggers token refresh when the access token is expired
3. The `setAll` cookie handler applies secure cookie options to the new tokens

### Session Invalidation on Logout

The `/api/auth/logout` endpoint:
1. Calls `supabase.auth.signOut({ scope: 'local' })` to invalidate the session server-side
2. Clears all Supabase auth cookies (prefixed with `sb-`)
3. Clears the guest cookie

### Invalid/Expired Session Handling

The middleware detects invalid sessions when:
1. Auth cookies are present but `supabase.auth.getUser()` returns an error
2. This means the access token is expired AND the refresh token is also invalid/expired

In this case:
- **API routes**: Return 401 with cookie clearing
- **Page routes**: Clear cookies and redirect to login

## Verification Checklist

After configuring the dashboard settings, verify:

- [ ] JWT expiry is set to 900 seconds
- [ ] Refresh token rotation is enabled
- [ ] Reuse interval is 0 seconds
- [ ] Session lifetime is 604800 seconds (7 days)
- [ ] OAuth providers have redirect URLs configured correctly for PKCE flow
- [ ] Test login → verify short-lived access token (check JWT `exp` claim)
- [ ] Test token refresh → verify new refresh token is issued
- [ ] Test logout → verify tokens are invalidated (old refresh token rejected)
- [ ] Test expired session → verify 401 response with cookie clearing

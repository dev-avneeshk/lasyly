# Requirements Document

## Introduction

This feature implements comprehensive security hardening across the Betroom Next.js betting/social platform. It addresses ten vulnerability classes: hotkey hijacking, cache security, race conditions, injection attacks, authentication/session management, input validation, cryptography, dependency supply chain, infrastructure headers, and error handling. The goal is to bring the platform to production-grade security posture before launch.

## Glossary

- **Platform**: The Betroom Next.js web application including all API routes, middleware, client components, and background services
- **API_Layer**: The set of Next.js API route handlers under `app/api/`
- **Middleware**: The Next.js middleware (`middleware.ts`) that intercepts all matching requests for auth checks and header injection
- **Cache_Layer**: The in-memory caching module (`lib/cache.ts`) used by API routes to reduce database queries
- **Auth_System**: The Supabase-based authentication system including session management, token refresh, and guest access
- **Input_Validator**: Server-side validation logic applied to all user-supplied data before processing
- **Security_Headers_Module**: The middleware component responsible for setting HTTP security response headers
- **Rate_Limiter**: A request throttling mechanism that limits the number of requests per client within a time window
- **Hotkey_Registry**: A centralized keyboard shortcut management system that scopes shortcuts to active UI contexts
- **Error_Handler**: The standardized error handling layer that formats error responses for clients and logs details server-side
- **Dependency_Auditor**: The process and tooling for scanning, pinning, and verifying third-party package integrity
- **Crypto_Module**: The module responsible for all cryptographic operations including hashing, encryption, and random value generation

## Requirements

### Requirement 1: Centralized Hotkey Registry

**User Story:** As a developer, I want a centralized keyboard shortcut registry with context scoping, so that shortcuts only fire within their intended UI context and cannot be hijacked by malicious input.

#### Acceptance Criteria

1. THE Hotkey_Registry SHALL maintain a single registry of up to 500 keyboard shortcuts, each mapped to exactly one owning UI context identifier
2. WHEN a keyboard event is received, THE Hotkey_Registry SHALL execute the shortcut handler only if the active UI context matches the shortcut's registered context, and SHALL complete handler lookup within 200ms
3. IF a shortcut configuration contains characters outside the allowed set of alphanumeric keys, modifier keys (Ctrl, Shift, Alt, Meta), function keys (F1–F12), arrow keys, Escape, Tab, and Space, or exceeds 4 keys per combination, THEN THE Hotkey_Registry SHALL reject the configuration and provide an observable error indication to the caller stating the reason for rejection
4. WHILE a modal or overlay is active, THE Hotkey_Registry SHALL suppress all shortcuts registered to contexts other than the active modal or overlay context
5. IF a duplicate shortcut binding is registered for the same context, THEN THE Hotkey_Registry SHALL reject the duplicate, retain the original binding, and provide an observable error indication to the caller identifying the conflicting shortcut
6. WHEN a keyboard event is received and no registered shortcut matches the current key combination in the active UI context, THE Hotkey_Registry SHALL take no action and allow the event to propagate to the default browser or platform handler

### Requirement 2: Cache Security

**User Story:** As a platform operator, I want the caching layer to be resilient against poisoning, miss storms, and sensitive data leakage, so that cached responses remain trustworthy and performant under load.

#### Acceptance Criteria

1. WHEN the Cache_Layer receives a store or retrieve request, THE Cache_Layer SHALL validate the cache key against an allowlist of known key patterns and reject the operation with an invalid-key error if the key does not match any allowed pattern
2. WHEN multiple concurrent requests arrive for the same expired cache key, THE Cache_Layer SHALL execute the fetcher function exactly once and serve the result to all waiting callers (thundering herd protection), with a maximum wait time of 5 seconds before returning an error to waiting callers
3. THE Cache_Layer SHALL apply a random jitter of up to 20% of the configured TTL to each cache entry's expiration time
4. WHEN a cache entry's TTL expires, THE Cache_Layer SHALL serve the stale entry to callers while a single background refresh executes (stale-while-revalidate), for a maximum staleness window of 60 seconds beyond the original TTL
5. THE Cache_Layer SHALL reject storage of any value whose cache key contains a user identifier combined with a sensitive data marker (tokens, passwords, secrets)
6. WHEN the API_Layer returns a response containing user-specific sensitive data (authentication tokens, passwords, session identifiers, or personal financial data), THE API_Layer SHALL set the Cache-Control header to "no-store, no-cache, must-revalidate, private"
7. WHEN the API_Layer returns a response containing public cacheable data, THE API_Layer SHALL set the Cache-Control header with max-age equal to the internal TTL value configured for that resource
8. IF the fetcher function fails or times out during thundering herd protection, THEN THE Cache_Layer SHALL return the error to all waiting callers and SHALL NOT store any value in the cache
9. IF the background refresh during stale-while-revalidate fails, THEN THE Cache_Layer SHALL continue serving the stale entry until the staleness window expires, after which subsequent requests SHALL trigger a synchronous fetch

### Requirement 3: Race Condition and Concurrency Protection

**User Story:** As a user, I want my actions (joining rooms, creating betslips, updating profiles) to produce correct results even when multiple requests arrive simultaneously, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN a user submits a room join request, THE API_Layer SHALL enforce a unique constraint on (room_id, user_id) in the room_members table so that concurrent duplicate insert attempts result in at most one membership record
2. WHEN a user updates their profile, THE API_Layer SHALL include an updated_at timestamp condition in the update query so that if another request modified the profile after the client last read it, the update affects zero rows and the API_Layer returns a conflict error indicating the profile was modified by another request
3. WHEN a betslip status is updated, THE API_Layer SHALL include the current status value as a condition in the update query so that the update affects zero rows if the status was changed by a concurrent request, and IF zero rows are affected, THEN THE API_Layer SHALL return a conflict error indicating the betslip status has already changed
4. THE API_Layer SHALL avoid storing mutable shared state in module-level variables that can be corrupted by concurrent request handlers
5. WHEN two concurrent requests attempt to create the same unique resource (a room membership for the same user and room, or a username that already exists), THE API_Layer SHALL allow exactly one to succeed and return a 409 conflict error to the other within 2 seconds of the request
6. IF a conflict error is returned due to a concurrent modification (stale profile update, duplicate membership, or betslip status already transitioned), THEN THE API_Layer SHALL preserve the original data unchanged and include in the error response the type of conflict encountered

### Requirement 4: Injection Prevention

**User Story:** As a platform operator, I want all data access and external command execution to be protected against injection attacks, so that attackers cannot manipulate queries or execute arbitrary commands.

#### Acceptance Criteria

1. THE API_Layer SHALL use parameterized queries or the Supabase client's built-in query builder for all database operations, with no string concatenation of user input into query strings
2. WHEN user input is used in a Supabase filter or query parameter, THE Input_Validator SHALL reject values containing NoSQL operator patterns ($gt, $lt, $ne, $regex, $where, $in, $nin, $exists, $or, $and, $not) and return a 400 status with an error message indicating that the input contains a disallowed operator pattern
3. THE Platform SHALL not execute shell commands with user-supplied input
4. IF shell execution is required for a platform operation, THEN THE Platform SHALL use an allowlist of permitted commands with parameterized arguments and SHALL reject any command not present in the allowlist
5. WHEN user-supplied content is rendered in server-side templates, THE Platform SHALL apply HTML entity encoding for HTML contexts and URL-percent encoding for URL contexts to prevent template injection
6. WHEN user-supplied content is rendered in email templates, THE Platform SHALL apply HTML entity encoding to all interpolated values to prevent template injection
7. IF the Input_Validator detects an injection pattern in any user-supplied input, THEN THE API_Layer SHALL reject the request with a 400 status and an error message indicating the input was rejected, without disclosing the specific pattern that was matched

### Requirement 5: Authentication and Session Security

**User Story:** As a user, I want my session to be protected against theft, fixation, and replay attacks, so that my account and betting data remain secure.

#### Acceptance Criteria

1. WHEN a user successfully authenticates, THE Auth_System SHALL rotate the session token by issuing a new token and invalidating the previous token to prevent session fixation attacks
2. THE Auth_System SHALL issue access tokens with a maximum lifetime of 15 minutes and refresh tokens with a maximum lifetime of 7 days for session continuity
3. THE Auth_System SHALL set all authentication cookies with the httpOnly, Secure, and SameSite=Strict attributes
4. WHEN a user logs out, THE Auth_System SHALL invalidate the session token and associated refresh token on the server side so that neither can be replayed
5. WHERE OAuth login is configured, THE Auth_System SHALL use PKCE (Proof Key for Code Exchange) for all OAuth authorization code flows
6. WHEN a session token is presented that does not match any active server-side session, THE Auth_System SHALL reject the request with a 401 status and clear the client cookie
7. WHEN a refresh token is used to obtain a new access token, THE Auth_System SHALL issue a new refresh token and invalidate the previous refresh token to prevent token replay from stolen credentials
8. IF a refresh token is expired, revoked, or does not match any active server-side record, THEN THE Auth_System SHALL reject the refresh request with a 401 status, invalidate all tokens for that session, and clear the client cookies

### Requirement 6: Input Validation and Output Encoding

**User Story:** As a developer, I want all user input to be validated on the server and all output to be properly encoded, so that the platform is protected against XSS, path traversal, and malformed data attacks.

#### Acceptance Criteria

1. THE Input_Validator SHALL validate all user-supplied request body fields for type, maximum length (255 characters for string fields unless a field-specific limit is defined elsewhere), and format (matching the expected data type: valid email syntax for email fields, UUID format for ID fields, ISO 8601 for date fields, numeric value for numeric fields) before processing
2. WHEN a request body field fails validation, THE API_Layer SHALL return a 400 status with a JSON response body containing the name of the invalid field and the specific constraint that was violated (type mismatch, length exceeded, or format invalid)
3. WHEN user-supplied content is included in HTML responses, THE Platform SHALL apply HTML entity encoding to the characters &, <, >, ", and ' to prevent cross-site scripting
4. WHEN a file upload path or filename is provided by the user, THE Input_Validator SHALL reject paths containing directory traversal sequences (../, ..\, %2e%2e, and double-encoded variants), null bytes, and filenames exceeding 255 characters
5. THE Input_Validator SHALL enforce a maximum request body size of 1MB for standard API endpoints and 10MB for file upload endpoints
6. IF a request body exceeds the maximum allowed size, THEN THE API_Layer SHALL reject the request with a 413 status and an error message indicating the size limit that was exceeded
7. WHEN user input contains HTML tags or script elements in text-only fields, THE Input_Validator SHALL reject the input with a 400 status indicating that HTML content is not permitted in the specified field
8. IF a file upload filename contains characters outside the set of alphanumeric characters, hyphens, underscores, periods, and spaces, THEN THE Input_Validator SHALL reject the upload with a 400 status indicating the filename contains disallowed characters

### Requirement 7: Cryptographic Standards

**User Story:** As a platform operator, I want all cryptographic operations to use current, secure algorithms, so that user data and credentials are protected against known cryptographic attacks.

#### Acceptance Criteria

1. THE Crypto_Module SHALL use AES-256-GCM for all symmetric encryption operations
2. THE Crypto_Module SHALL use Argon2id with a minimum memory cost of 64MB, minimum iteration count of 3, a minimum parallelism degree of 1, and a minimum salt length of 16 bytes for password hashing
3. THE Platform SHALL enforce TLS 1.2 as the minimum protocol version for all inbound and outbound external connections
4. IF a client attempts to establish a connection using a protocol version below TLS 1.2, THEN THE Platform SHALL reject the connection and refuse to transmit any application data
5. THE Crypto_Module SHALL use a cryptographically secure pseudo-random number generator (CSPRNG) for all token generation, nonce creation, and random value operations
6. THE Crypto_Module SHALL not use MD5, SHA-1, DES, 3DES, or RC4 for any operation involving authentication, encryption, digital signatures, key derivation, or integrity verification
7. WHEN generating session tokens or API keys, THE Crypto_Module SHALL produce values with a minimum of 256 bits of entropy

### Requirement 8: Dependency and Supply Chain Security

**User Story:** As a developer, I want dependencies to be audited, pinned, and verified, so that the platform is protected against supply chain attacks and known vulnerabilities.

#### Acceptance Criteria

1. THE Dependency_Auditor SHALL run automated vulnerability scanning on all direct and transitive dependencies on every CI pipeline execution
2. WHEN a dependency with a known vulnerability scored at CVSS v3.1 7.0 or higher is detected, THE Dependency_Auditor SHALL fail the CI build and report the affected package name, installed version, and associated CVE identifier
3. THE Platform SHALL pin all production dependencies to exact versions in the lockfile, with no range operators (^, ~, >=, *)
4. THE Platform SHALL include Subresource Integrity (SRI) hashes using SHA-384 or stronger for all externally-loaded scripts and stylesheets
5. IF a dependency has not received a release in 12 months and has one or more known vulnerabilities of any severity, THEN THE Dependency_Auditor SHALL generate a warning in the CI output identifying the package and recommending replacement or removal
6. THE Platform SHALL not include dependencies in the production bundle that are not imported or referenced by any production code path, as determined by static analysis during the build step
7. IF the vulnerability scanning service is unavailable during a CI pipeline execution, THEN THE Dependency_Auditor SHALL fail the build and report that dependency verification could not be completed

### Requirement 9: Infrastructure and Security Headers

**User Story:** As a platform operator, I want comprehensive security headers on all responses, so that the platform is protected against clickjacking, MIME sniffing, XSS, and data leakage via referrer or browser features.

#### Acceptance Criteria

1. THE Security_Headers_Module SHALL set a Content-Security-Policy header that restricts script-src to 'self' and domains listed in the platform's trusted-domains configuration, disallows 'unsafe-inline' and 'unsafe-eval' for script-src, and sets object-src to 'none'
2. THE Security_Headers_Module SHALL set the Strict-Transport-Security header with a max-age of at least 31536000 seconds and include the includeSubDomains directive
3. THE Security_Headers_Module SHALL set X-Content-Type-Options to "nosniff" on all responses including error responses (4xx and 5xx)
4. THE Security_Headers_Module SHALL set X-Frame-Options to "DENY" on all responses including error responses (4xx and 5xx)
5. THE Security_Headers_Module SHALL set Referrer-Policy to "strict-origin-when-cross-origin" on all responses including error responses (4xx and 5xx)
6. THE Security_Headers_Module SHALL set a Permissions-Policy header that disables camera, microphone, geolocation, and payment APIs by setting each to an empty allowlist ()
7. THE Middleware SHALL configure CORS to allow requests only from the Platform's own origin and origins listed in the platform's allowed-origins configuration, limited to a maximum of 20 configured origins
8. IF a request originates from an origin not present in the allowed-origins configuration and not matching the Platform's own origin, THEN THE Middleware SHALL reject the request by omitting CORS response headers, causing the browser to block the response
9. THE Platform SHALL remove or suppress the X-Powered-By and Server headers from all responses so that no server software name or version is disclosed
10. THE Security_Headers_Module SHALL apply all security headers (criteria 1–6) to every HTTP response regardless of status code, content type, or route

### Requirement 10: Rate Limiting

**User Story:** As a platform operator, I want API endpoints to be rate-limited, so that the platform is protected against brute-force attacks, credential stuffing, and denial-of-service attempts.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce a maximum of 10 requests per minute on authentication endpoints (login, signup, password reset)
2. THE Rate_Limiter SHALL enforce a maximum of 60 requests per minute on standard API endpoints per authenticated user
3. THE Rate_Limiter SHALL enforce a maximum of 30 requests per minute on standard API endpoints per unauthenticated IP address
4. WHEN a client exceeds the rate limit, THE Rate_Limiter SHALL return a 429 status with a Retry-After header indicating the number of seconds remaining until the current sliding window resets for that client
5. THE Rate_Limiter SHALL use a sliding window algorithm to prevent burst abuse at window boundaries
6. IF a single IP address exceeds 5 times the standard rate limit within one minute, THEN THE Rate_Limiter SHALL block all new requests from that IP for 15 minutes, return a 429 status for each blocked request, and log the event including the IP address and timestamp
7. WHEN a client receives a 429 response, THE Rate_Limiter SHALL include response headers indicating the rate limit ceiling (maximum requests allowed), the number of remaining requests in the current window, and the window reset time in seconds

### Requirement 11: Error Handling and Structured Logging

**User Story:** As a developer, I want errors to be handled consistently without leaking internal details to clients, and all security-relevant events to be logged in a structured format, so that incidents can be detected and investigated.

#### Acceptance Criteria

1. WHEN an unhandled error occurs in the API_Layer, THE Error_Handler SHALL return a response containing only the fields defined in criterion 6, with the error field set to a static message that does not include stack traces, internal file paths, database error details, or environment variable names
2. WHEN an error is handled by the Error_Handler, THE Error_Handler SHALL log the full error details including stack trace, request method, request path, user ID (if authenticated), and correlation ID to the server-side structured logging system in JSON format
3. THE Error_Handler SHALL assign a correlation ID in UUID v4 format to each error occurrence and include it in both the client response (as the correlationId field) and the corresponding server log entry
4. WHEN a security-relevant event occurs (failed login, rate limit exceeded, invalid token, permission denied), THE Error_Handler SHALL log the event in JSON format with a "security" severity tag including ISO 8601 timestamp, source IP, user ID if available, event type, and correlation ID
5. THE Platform SHALL store secrets (API keys, database credentials, service role keys) exclusively in environment variables or a secrets manager, and SHALL NOT log secret values, connection strings, or authentication tokens in any log output
6. WHEN the API_Layer returns an error response, THE Error_Handler SHALL use a JSON response body containing exactly three fields: error (a human-readable string of at most 200 characters describing the failure category), code (an UPPER_SNAKE_CASE string of at most 50 characters identifying the error type), and correlationId (the UUID v4 assigned per criterion 3)
7. IF the structured logging system is unreachable or write fails, THEN THE Error_Handler SHALL still return the error response to the client as defined in criterion 6 and SHALL NOT expose the logging failure to the client

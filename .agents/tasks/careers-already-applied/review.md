# Careers "already applied" detection + admin account visibility

Signed-in accounts can now apply only once per scope (a specific job, or the general talent pool), and the apply form shows an "already applied" card instead of letting them resubmit. The change records `user_id` on each application, backs the one-per-scope rule with two partial unique Postgres indexes, adds a fail-open `GET /mine` lookup the form calls after sign-in, converts the submit route's duplicate case into a clean `409 ALREADY_APPLIED { reference }`, and surfaces "Authenticated submission" on the admin detail page. The admin list page that answers "who applied" already existed and already shows reference + key details, so no new list page was built.

Watch for: nothing blocking. The migration is authored but not applied in this worktree (noted as out of scope — confirmed), and the routes don't assume the column exists at build time, so this is a deploy-time sequencing note, not a code defect (confirmed). Verification evidence (build, lint, 38 careers tests) is recorded in the plan and backed by the test files on disk.

**Verdict**: APPROVED

## High-level view

The one-per-scope rule is enforced in two layers. The partial unique indexes (`user_id + job_id` for a specific role, `user_id` where `job_id IS NULL` for the general pool) are the hard guarantee; the submit route's pre-insert lookup and the `GET /mine` endpoint are UX conveniences that turn the common case into a clean 409 / "already applied" card before the DB ever rejects a write. The 23505 handler re-checks the account+scope first and only then falls back to the existing `submission_key` idempotency path, so a true race still resolves to the right message.

The lookup endpoint deliberately fails open: no session, invalid `jobId`, a tripped rate limit, or a DB error all return `{ applied: false }` so the form always renders. Enforcement lives in POST, not in the GET, which keeps the client simple and avoids a lookup outage blocking legitimate applicants.

The API surface stays minimal and additive: `user_id` on the insert, a `reference`-only `409 { code: "ALREADY_APPLIED", reference }`, and a single new `GET /api/careers/applications/mine` that returns `{ applied, reference? }`. Only the short reference is ever exposed — never the row id or `user_id`.

Admin visibility needed almost nothing new: the existing `/admin/careers` list (gated by `getCareersAdmin`, service-role reads via `listApplications`) already shows applicant, `#reference`, position, experience, submitted date, and status, linking to a full detail page. The only addition is an "Account" row on the detail page showing "Authenticated submission" vs "—", which avoids leaking the raw `user_id`.

<details>
<summary>Issues (3)</summary>

1. **Migration apply sequencing (non-blocking, informational)** — `confirmed`: the `20261007` migration is authored but not applied in this worktree (out of scope per the plan). Apply it before the `user_id` reads/writes and the unique indexes go live, or the new queries fail against a DB that lacks the column.
2. **23505 race branch untested (non-blocking)** — `confirmed`: the unique-violation fallback (account re-select, then `submission_key` fallback) has no dedicated test case. Add one asserting the account+scope re-select precedence to lock in the behavior.
3. **Unrelated changes in the branch (non-blocking)** — `confirmed`: the branch diff includes scores/analysis/blog/deps churn unrelated to careers. Confirm the careers commit (`2158281`) is isolated before merge if those changes aren't intended for this PR.

</details>

<details>
<summary>Details</summary>

### Two-layer enforcement: partial unique indexes + app-level pre-check

The migration adds the real guarantee. `user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL` is nullable (legacy rows and deleted-account rows stay valid), and two partial unique indexes encode the scope rule exactly as the task requires:

```sql
CREATE UNIQUE INDEX ... careers_applications_user_job_uniq
  ON ... (user_id, job_id)   WHERE user_id IS NOT NULL AND job_id IS NOT NULL;
CREATE UNIQUE INDEX ... careers_applications_user_general_uniq
  ON ... (user_id)           WHERE user_id IS NOT NULL AND job_id IS NULL;
```

The job-scoped index keys on `(user_id, job_id)`, and the general-pool index keys on `user_id` alone with the `job_id IS NULL` predicate — the two cases can't collide and a NULL `user_id` (legacy rows) is excluded from both. A plain partial lookup index backs the "already applied?" query. The file is wrapped in `BEGIN;`/`COMMIT;`, ends with `REVOKE ALL ... FROM anon, authenticated` to match the convention in the two prior careers migrations, and adds no `CREATE POLICY`, preserving the RLS-enabled-no-policies / service-role-only model. Filename `20261007_careers_application_user.sql` is later than the newest existing careers migration (`20261006`) and satisfies the `>= 20261006` ordering.

The app-level pre-check (`scopedByUser().maybeSingle()`) runs after auth, honeypot/validation, the `submission_key` idempotency lookup, and `jobTitle` resolution. The scope helper is the single source of truth for "this job vs general" — `jobId ? q.eq("job_id", jobId) : q.is("job_id", null)` — and it's reused verbatim in the 23505 handler, so the pre-check and the race fallback can't drift apart. A lookup error here returns a generic 500 rather than silently inserting a possible duplicate, which is the right failure direction given the DB index is the backstop.

### 23505 race handling covers both index families

The duplicate handler was widened correctly. On `insert.error.code === "23505"` it now re-selects by `user_id + scope` first and returns `ALREADY_APPLIED` with the existing reference; only if that finds nothing does it fall back to the pre-existing `submission_key` re-select returning `{ reference, duplicate: true }`. This matters because a 23505 can now come from either the new user/job (or user/general) unique indexes or the original `submission_key` constraint, and the two produce different client contracts (`ALREADY_APPLIED` card vs transparent idempotent success). Checking account+scope first is the correct precedence: a same-account duplicate should surface as "already applied", while a retried identical submission should stay invisible.

### Fail-open lookup endpoint

`GET /api/careers/applications/mine` is wrapped in `withSecurity` (SENSITIVE no-store cache headers, matching the sibling POST and admin routes) and reads the session via `createClient()`, which forces dynamic rendering — correctly, no `force-static` is added. Every non-match path returns `{ applied: false }`: tripped rate limit, no user / anonymous user, invalid `jobId` (validated with `isUuid`, treated as no-match rather than a 400), DB error (logged server-side), or thrown exception. The scope lookup uses `createAdminClient()` (service role, since `careers_applications` has no RLS policies) and selects only `reference`. The contract (`{ applied, reference? }`) and conventions line up with the other careers routes.

### Form render gating and the already-applied card

The form adds `applicationCheck: "idle" | "checking" | "done"` and `appliedReference`. The check effect fires only once auth resolves to `signedIn`, resets to `idle` on sign-out so a later sign-in re-checks, and uses the existing `cancelled` unmount guard. The skeleton render condition — `auth === "checking" || (auth === "signedIn" && applicationCheck !== "done")` — holds the skeleton until both auth and the lookup settle, so the empty form never flashes before the already-applied card. The `jobId`-present branch sends `?jobId=`; the general pool omits the param, matching the server's scope keying.

The already-applied card reuses the success-screen shell classes (`careers-rise rounded-2xl border ... bg-[var(--color-surface)] ... text-center`), the same Application-ID box (`inline-flex flex-col items-center rounded-xl border ... bg-[var(--color-surface-elevated)]`) rendering `#{appliedReference}` in the mono/tabular style, and the lime pill `Link href="/careers"`. The POST 409 path (`res.status === 409 && data?.code === "ALREADY_APPLIED" && data.reference`) switches into the identical state rather than showing a generic form error, so a cross-tab/device race lands on the same card. The `JOB_UNAVAILABLE` 409, the 401 session-expired handling, success screen, validation, honeypot, and `submissionKey` paths are untouched. The response type was widened to include `code?: string`, which is the only change needed for the new branch to typecheck.

Note the 409 body shape depends on `fail(status, error, extra)` spreading `extra` to the top level (`{ error, ...extra }`), so `code` and `reference` are top-level fields the client reads directly — consistent across the pre-check and the race fallback.

### Admin visibility

`lib/careers/server.ts` adds `userId: string | null` to the `Application` interface, maps `r.user_id` in `toApplication`, and appends `user_id` to `APPLICATION_COLUMNS` so the detail read returns it. The detail page adds one `rows` entry — `{ label: "Account", value: app.userId ? "Authenticated submission" : "—" }` — which shows that a submission came from a signed-in account without rendering the raw id. The list page (`app/(app)/admin/careers/page.tsx`) was confirmed present and unchanged: `getCareersAdmin()` gate with `notFound()` for non-admins, `AdminShell`, service-role `listApplications`, newest-first with status filter and pagination, and `#{reference}` shown under each applicant name linking to the detail page. This satisfies the "where can I see who applied" ask without over-building.

### Test coverage

The submit-route test mock distinguishes the two select lookups by first-filtered column (`user_id` → `userLookup`, else `keyLookup`) and supports the added `.is(...)` link, so the pre-insert scope query is exercised independently of idempotency. New cases cover `user_id` recorded on a first application (`inserted[0].user_id === "u1"`) and a 409 `ALREADY_APPLIED` that returns the existing reference and performs no insert. The new `applications-mine-route.test.ts` covers signed-out, a matching row with reference, no row, invalid `jobId`, and absent `jobId` (general pool) — all five fail-open/match paths. The plan records 38 careers tests passing (up from 31 baseline), lint clean on changed files, and a green `next build --webpack` typecheck/build listing the new dynamic route; the test files on disk back the counts.

Not tested: the 23505 race branch (both the account re-select and the submission_key fallback after a unique violation) isn't covered by a dedicated case — `insertError` exists in the mock but the race precedence isn't asserted. This is a secondary path behind the DB indexes and the pre-check, so it's a coverage gap worth noting rather than a blocker.

### Unrelated changes bundled in the diff

`git diff main --stat` shows the branch also contains scores/ESPN work, analysis components, blog/marketing edits, `lib/props/odds.ts` removal, and `package.json`/`package-lock.json` churn. These are out of scope for this review (not part of the careers feature) and are not evaluated here; they appear to be inherited from the branch point rather than introduced by this task's commit, but a reviewer merging this should confirm the careers commit (`2158281`) is isolated if these other changes aren't intended.

</details>

<details>
<summary>File map</summary>

- `supabase/migrations/20261007_careers_application_user.sql` — new: `user_id` column + two partial unique indexes + lookup index, REVOKE, no RLS policy.
- `app/api/careers/applications/route.ts` — pre-insert ALREADY_APPLIED check, `user_id` on insert, 23505 account+scope race fallback.
- `app/api/careers/applications/mine/route.ts` — new: fail-open `GET` returning `{ applied, reference? }`.
- `components/careers/ApplicationForm.tsx` — post-sign-in lookup, render gating, already-applied card, POST 409 handling.
- `lib/careers/server.ts` — `userId` on `Application`, mapped in `toApplication`, added to `APPLICATION_COLUMNS`.
- `app/(app)/admin/careers/applications/[id]/page.tsx` — "Account" detail row.

Other files in the branch diff (scores, analysis, blog/marketing, deps) are unrelated to this task and not reviewed here.

Full careers diff: `git -C /Users/ayushkumar/development/betroom/.worktrees/careers-already-applied diff main -- app/api/careers components/careers lib/careers supabase/migrations/20261007_careers_application_user.sql "app/(app)/admin/careers"`

</details>

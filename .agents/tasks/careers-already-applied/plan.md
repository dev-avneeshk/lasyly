# Implementation Plan — Careers "already applied" detection + admin visibility

All paths are absolute under the worktree
`/Users/ayushkumar/development/betroom/.worktrees/careers-already-applied`.
Relative paths from a different cwd land in the parent repo — always use the
absolute worktree paths below.

## Context discovered during exploration (read before coding)

- **Next.js version: 16.3.4** (`node_modules/next` resolves from the main repo
  `/Users/ayushkumar/development/betroom/node_modules`; the worktree has no
  `node_modules` of its own, but Node resolves upward so `npx`, `npm test`,
  `npm run build` all work when run from the worktree root). Docs live at
  `/Users/ayushkumar/development/betroom/node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.
- **Next 16 route-handler conventions that matter here:**
  - `GET`/`POST` handlers receive a Web `Request`; dynamic route `context.params`
    is a `Promise` and must be awaited (existing code already does
    `await context!.params` and `await params`). Follow that exact shape.
  - Route Handlers are **not cached by default**; a user-specific `GET` must stay
    dynamic. Do NOT add `export const dynamic = "force-static"` to the new
    lookup route (that is only on the static apply *page*). Reading cookies via
    `createClient()` (which calls `await cookies()`) already forces dynamic
    rendering, so no extra config is needed. Deprecation note: do not use the
    old Pages-router `pages/api` style or sync `params`.
- **Verification commands (run from the worktree root):**
  - Typecheck + production build: `npm run build` (script is `next build --webpack`).
  - Unit tests: `npm test` (script is `vitest run`); scope with
    `npx --no-install vitest run __tests__/careers` for the fast loop.
  - Lint: `npm run lint` (eslint).
  - Baseline confirmed green before changes: `__tests__/careers` = 31 tests pass.
- **Supabase clients:** `createClient()` from `@/lib/supabase/server` (anon +
  user session, reads cookies) for auth; `createAdminClient()` from
  `@/lib/supabase/admin` (service role, bypasses RLS) for all DB reads/writes on
  `careers_applications` (RLS enabled, NO policies — service role only).
- **`isUuid`** is exported from `@/lib/careers/server`.
- **`withSecurity`** (`@/lib/security/routeHelpers`) wraps `(request, context)`
  for any method and sets `Cache-Control` (SENSITIVE preset) on the response;
  use it for the new GET to match the POST route and admin routes.
- **Rate limiting:** `checkRateLimit(key, RATE_LIMITS.x)` from `@/lib/rateLimit`;
  `getClientIp(request)` from `@/lib/security/clientIp`. The POST route uses
  `RATE_LIMITS.careersApplyIp` / `careersApplyEmail`.

## Task 2 finding (admin visibility) — report, mostly already built

An admin applications **LIST page already exists**:

- **Route / URL: `/admin/careers`** → file
  `app/(app)/admin/careers/page.tsx`. Gated by `getCareersAdmin()`
  (`notFound()` for non-admins), uses `AdminShell`, service-role read via
  `listApplications()` in `lib/careers/server.ts`. Shows, newest-first, with a
  status filter and pagination: **Applicant** (full_name + `#reference`),
  **Position** (job_title or "General application"), **Experience**,
  **Submitted** (created_at), **Status** (`StatusBadge`). Each row links to the
  detail page.
- **Detail page: `/admin/careers/applications/[id]`** → file
  `app/(app)/admin/careers/applications/[id]/page.tsx`. Shows full_name, email
  (mailto), phone (tel), location, current job/company, experience, LinkedIn,
  portfolio, referral, position, applied date, consent date, fit answer, and a
  `StatusSelect` to change status (PATCH `/api/careers/admin/applications/[id]`).

So Task 2 needs **no new list page**. The only addition is to minimally surface
that a submission came from a signed-in account (see step 6). Do not over-build.

---

# Steps

- [ ] 1. Add the `user_id` migration for `careers_applications`.
      Create a new migration that adds a nullable `user_id UUID` column
      referencing `auth.users(id) ON DELETE SET NULL`, two partial unique
      indexes, and a plain lookup index — wrapped in `BEGIN/COMMIT`, keeping the
      service-role-only (no-RLS-policy) model intact. Pin the filename to
      **`20261007_careers_application_user.sql`** (newest existing careers
      migration is `20261006_careers_portfolio_fit_answer.sql`; `20261007` is
      later and `>= 20261006`). Contents:
      - `ALTER TABLE public.careers_applications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;`
      - `CREATE UNIQUE INDEX IF NOT EXISTS careers_applications_user_job_uniq ON public.careers_applications (user_id, job_id) WHERE user_id IS NOT NULL AND job_id IS NOT NULL;`
      - `CREATE UNIQUE INDEX IF NOT EXISTS careers_applications_user_general_uniq ON public.careers_applications (user_id) WHERE user_id IS NOT NULL AND job_id IS NULL;`
      - `CREATE INDEX IF NOT EXISTS idx_careers_applications_user ON public.careers_applications (user_id) WHERE user_id IS NOT NULL;`
      - End with `REVOKE ALL ON public.careers_applications FROM anon, authenticated;` (matches the convention in the prior two migrations) and a `COMMENT ON COLUMN` describing the column. No new RLS policies.
      Files: `supabase/migrations/20261007_careers_application_user.sql`
      Verify: `npm run build` still succeeds (migration is SQL only, not compiled, so this is just a no-regression check). SQL review: confirm `BEGIN;` … `COMMIT;` wrap, both partial unique indexes present with the exact `WHERE` predicates above, and no `CREATE POLICY`. (DB apply is out of scope for this worktree; the coder does not run `db:apply`.)

- [ ] 2. Enforce "already applied" + record `user_id` in the submit route.
      In `app/api/careers/applications/route.ts`, inside the existing `POST`
      handler, after auth (`user`) + honeypot/validation and the existing
      `submission_key` idempotency lookup, and after `jobTitle` is resolved:
      - Compute the scope: `job` → `job_id = jobId`; `general` → `job_id IS NULL`
        (`.is("job_id", null)`). Query `careers_applications` with
        `createAdminClient()` for a row where `user_id = user.id` AND the scope
        matches, selecting `reference`. If found, return **409** with
        `{ error: <friendly msg>, code: "ALREADY_APPLIED", reference }` via the
        existing `fail(...)` helper plus the `reference` extra.
      - Add `user_id: user.id` to the `.insert({...})` object.
      - Make the 23505 (unique_violation) handler race-safe for the two new
        indexes: on `insert.error.code === "23505"`, FIRST re-select by
        `user_id + scope` and, if found, return the same `ALREADY_APPLIED` 409;
        otherwise fall back to the existing re-select by `submission_key`
        (returning `{ reference, duplicate: true }`). Keep the existing
        submission_key path working.
      - Only expose `reference` (never row id / internal fields); keep error
        copy generic elsewhere.
      Files: `app/api/careers/applications/route.ts`
      Verify: `npx --no-install vitest run __tests__/careers/applications-route.test.ts`
      — existing tests still pass (note: the current admin mock chains
      `select().eq().maybeSingle()`; the new pre-insert scope query adds an
      `.is("job_id", null)` / `.eq("job_id", jobId)` link, so update that test's
      `@/lib/supabase/admin` mock to also support `.is(...)` and the extra
      `.eq(...).maybeSingle()` returning `{ data: null }`). Add new test cases:
      (a) a pre-existing row for the same `user_id`+scope returns 409 with
      `code: "ALREADY_APPLIED"` and the existing reference and performs no
      insert; (b) a normal first application still returns 201 and the insert row
      includes `user_id: "u1"`.

- [ ] 3. Add the GET lookup endpoint `/api/careers/applications/mine`.
      Create `app/api/careers/applications/mine/route.ts` exporting
      `GET = withSecurity(async (request) => { ... })`. Behaviour:
      - Resolve the user with `await createClient()` + `auth.getUser()`. If no
        user or `user.is_anonymous`, return `{ applied: false }` (200) — prefer
        this over erroring so the client stays simple.
      - Read `jobId` from the query string (`new URL(request.url).searchParams.get("jobId")`).
        If present, validate with `isUuid`; on an invalid value return
        `{ applied: false }` (do not 400 — keep client simple). Absent/empty =
        general pool.
      - With `createAdminClient()`, select `reference` from
        `careers_applications` where `user_id = user.id` and scope matches
        (`.eq("job_id", jobId)` when set, else `.is("job_id", null)`),
        `.maybeSingle()`. Return `{ applied: true, reference }` when found, else
        `{ applied: false }`.
      - On a DB error, log server-side and return `{ applied: false }` (fail
        open to the form, never leak details).
      - Light rate-limit by IP mirroring the POST route style:
        `checkRateLimit(\`careers:mine:ip:${getClientIp(request)}\`, RATE_LIMITS.careersApplyIp)`;
        on not-allowed, still return `{ applied: false }` (never block the form
        from rendering). Do NOT add `dynamic = "force-static"` (step-context note
        above). `withSecurity` already sets the SENSITIVE no-store Cache-Control.
      Files: `app/api/careers/applications/mine/route.ts`
      Verify: `npm run build` compiles the new route. Add
      `__tests__/careers/applications-mine-route.test.ts` (mirror the mocking
      style of `applications-route.test.ts`): signed-out → `{ applied: false }`;
      signed-in with an existing row → `{ applied: true, reference }`; signed-in
      with no row → `{ applied: false }`; invalid `jobId` → `{ applied: false }`.
      Run `npx --no-install vitest run __tests__/careers`.

- [ ] 4. Render an "already applied" state in the application form.
      In `components/careers/ApplicationForm.tsx`:
      - Add an `alreadyApplied` piece of state (e.g. extend the auth/check model
        with an `applicationCheck: "idle" | "checking" | "done"` and an
        `appliedReference: string | null`). After auth resolves to `signedIn`,
        fire `GET /api/careers/applications/mine` with `?jobId=${jobId}` only
        when `jobId` is non-null (omit the param for the general pool), guarded
        against the unmount via the existing `cancelled` pattern. While that
        request is in flight keep showing the existing `auth === "checking"`
        skeleton (gate the form render on both auth AND the applied-check
        completing).
      - If the response is `{ applied: true, reference }`, render a new
        "Already applied" card instead of the form. Reuse the success-screen /
        `SignInGate` structure and the exact same Tailwind classes: the
        `careers-rise rounded-2xl border ... bg-[var(--color-surface)] ... text-center`
        shell, a heading like "You've already applied", one short muted line, the
        existing Application-ID box
        (`inline-flex flex-col items-center rounded-xl border ... bg-[var(--color-surface-elevated)] ...`
        with the `Application ID` label and `#{reference}` in the mono style),
        and a "Back to Careers" `Link href="/careers"` using the existing lime
        pill button classes.
      - Handle the POST 409 two-tab case: in `onSubmit`, when
        `res.status === 409 && data?.code === "ALREADY_APPLIED" && data.reference`,
        switch into the same "already applied" state using the returned
        `reference` (do not just show the generic 409 form error). Keep the other
        409 handling (`JOB_UNAVAILABLE`) showing `data.error` as before.
      - Preserve ALL existing behaviour: `SignInGate` when signed out, the
        success screen, validation, honeypot, `submissionKey`, and the auth
        `onAuthStateChange` subscription.
      Files: `components/careers/ApplicationForm.tsx`
      Verify: `npm run build` succeeds (client component typechecks) and
      `npm run lint` passes for the file. Manually trace the three render
      branches (checking skeleton → already-applied card / form) in the diff for
      class parity with the success screen.

- [ ] 5. Surface "authenticated submission" minimally in the admin detail page.
      Extend the admin read + detail view to show that an application came from a
      signed-in account, without exposing the raw `user_id` value as a leak:
      - In `lib/careers/server.ts`: add `userId: string | null` to the
        `Application` interface, map `r.user_id` in `toApplication`, and add
        `user_id` to `APPLICATION_COLUMNS`.
      - In `app/(app)/admin/careers/applications/[id]/page.tsx`: add one `rows`
        entry, e.g. `{ label: "Account", value: app.userId ? "Authenticated submission" : "—" }`
        (show the short `user_id` prefix only if genuinely useful; default to the
        plain "Authenticated submission" label to avoid leaking the full id in
        the UI). Do not change the list page columns (out of scope / avoid
        over-building).
      Files: `lib/careers/server.ts`,
      `app/(app)/admin/careers/applications/[id]/page.tsx`
      Verify: `npm run build` succeeds (type change in `Application` propagates
      cleanly) and `npx --no-install vitest run __tests__/careers` stays green.

- [ ] 6. Full regression gate.
      Run the whole suite and the production build to confirm nothing else broke.
      Files: none (verification only)
      Verify: `npm test` (full `vitest run`) passes and `npm run build`
      (`next build --webpack`) completes without type or build errors. Also
      `npm run lint`. Clean up any scratch files created during verification.

## Verification results (iteration 1 — do not re-run to review)

Run from the worktree root `/Users/ayushkumar/development/betroom/.worktrees/careers-already-applied`:

- **Careers unit tests**: `npx --no-install vitest run __tests__/careers` →
  **3 files, 38 tests passed** (was 31 baseline; +7 new/updated: POST records
  `user_id`, POST 409 `ALREADY_APPLIED` with existing reference + no insert, and
  5 cases in the new `applications-mine-route.test.ts`).
- **Lint**: `npm run lint` → **0 errors** (383 pre-existing warnings, none in any
  file I changed — confirmed by grepping the lint output for the changed paths).
- **Production build / typecheck**: `npm run build` (`next build --webpack`,
  Next.js 16.3.4) → **"Compiled successfully"** and **"Finished TypeScript"**
  with no type errors; full page-data collection completed and the route table
  lists `ƒ /api/careers/applications/mine` (dynamic, not cached) and
  `ƒ /api/careers/applications` alongside the admin routes.
  - Note: the build's env-validation step (`lib/env.ts`) needs
    `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, which the
    worktree lacks (only the parent repo has `.env.local`). TypeScript compiles
    and typechecks green without them; to get a fully-green page-data pass I
    temporarily copied the parent `.env.local` into the worktree (it is
    `.gitignore`d — confirmed via `git check-ignore`), ran the build to
    completion, then deleted it. Nothing env-related is committed.
- **Grep checks**: both `/api/careers/applications/mine` and `ALREADY_APPLIED`
  appear in **both** the client (`components/careers/ApplicationForm.tsx`) and
  the server (`app/api/careers/applications/route.ts`).
- **Migration SQL review**: `supabase/migrations/20261007_careers_application_user.sql`
  — wrapped in `BEGIN;` … `COMMIT;`, nullable `user_id UUID REFERENCES
  auth.users(id) ON DELETE SET NULL`, both partial unique indexes with the exact
  `WHERE` predicates (`user_id IS NOT NULL AND job_id IS NOT NULL`;
  `user_id IS NOT NULL AND job_id IS NULL`), a plain partial lookup index, a
  `REVOKE ALL … FROM anon, authenticated`, and no `CREATE POLICY`.

## Assumptions / gaps noted

- **DB apply is out of scope in this worktree.** The migration file is authored
  and reviewed for correctness, but `npm run db:apply` is not run here; the
  routes must not assume the column exists at build time (they don't — Supabase
  queries are untyped `from("careers_applications")`). If tests ever run against
  a live DB without the migration, the new `user_id` queries would fail; the
  current tests mock Supabase, so they are unaffected.
- **"General pool" scope key** is `job_id IS NULL` (Supabase `.is("job_id", null)`),
  consistent with `application_type = 'general'`; the plan keys uniqueness and
  lookups on `job_id` nullness to match the two partial indexes exactly.
- The admin **list** page already shows reference + key details, so per the task
  it only needs the minimal "authenticated submission" surfacing, placed on the
  detail page (step 5) rather than cluttering the list.

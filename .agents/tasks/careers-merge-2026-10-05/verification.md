# Verification: replace CV upload with portfolio link + fit answer

Iteration 1 (no review.json existed). Run in the `careers-merge` worktree on branch `merge/careers-main`.

## Commands and results

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0, no output |
| `npm run lint` | 0 errors, 386 warnings (all pre-existing, in files this change doesn't touch). `npx eslint` on the changed dirs reports 0 problems. |
| `npx vitest --run --exclude '**/e2e/**'` | 110 files passed, 1 skipped. 1286 tests passed, 16 skipped. |
| `npm run build` | exit 0. Logs show `ECONNREFUSED 127.0.0.1:8079` because no local Redis was running. That was there before this change and doesn't fail the build. |
| `git grep -i filexl -- . ':!supabase/migrations/20260930_create_careers.sql'` | no matches |

New tests are in `__tests__/careers/` (22 tests):
- `application-validation.test.ts` checks the shared zod schema:
  - Accepts a valid payload and trims the link.
  - Accepts http and https.
  - Rejects `javascript:`, `JavaScript:`, `data:`, `vbscript:`, `file:`, `ftp:`, links with no scheme, and `localhost`.
  - Requires both fields, and enforces the 500-character link limit and the 50–3000 character answer length.
  - Cleans up the answer text but keeps line breaks.
  - Drops `cvFileUrl`.
  - Reports field errors under `fields.*`.
- `applications-route.test.ts` calls the POST handler through `withSecurity` with Supabase, rate limiting and auth mocked:
  - A valid payload returns 201 and inserts `portfolio_url` and `fit_answer`, with no `cv_file_url`.
  - A `javascript:` link returns 400 with `fields.portfolioUrl`.
  - A too-short answer returns 400 with `fields.fitAnswer`.

## Visual check (Playwright)

I ran a playwright-core 1.63.0 script with the cached Chromium 1223 against `PORT=3100 node server.mjs` started from the worktree. To get past the client-side sign-in gate, the script set a fake session cookie. All Supabase network calls were blocked and nothing was submitted. Every check passed:
- `/careers`:
  - No "resume" text anywhere.
  - CTAs read "Join the Talent Pool".
- `/careers/apply/general`:
  - Page title is "Join the Talent Pool — Careers".
  - The header notice "We don't shortlist on CVs. Every applicant gets a direct assessment link." is shown.
  - No iframe, no "Upload Your CV" and no "Accepted formats" text.
- Fields:
  - The "Portfolio or GitHub link" input has `type=url`.
  - The "Why are you a fit for Lasyly?" field is a textarea.
  - The form shows a `role=note` notice.
- Client-side validation:
  - Typing `javascript:alert(1)` shows the http(s) error and sets `aria-invalid`.
  - "Too short." shows the at-least-50-characters error, and the counter reads "10 / 3000 characters · 40 more needed".
  - Both errors clear once the values are valid.
- Real job route `/careers/apply/<uuid>`: the field label is "Why are you a fit for this role?".

Afterwards I stopped the dev server and deleted the scratch files and screenshots.

## Not verified

- The migration `20261006_careers_portfolio_fit_answer.sql` has not been applied to any database, as instructed.
- No real form submission against Supabase.

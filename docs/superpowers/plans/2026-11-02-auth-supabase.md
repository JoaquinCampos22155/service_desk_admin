# Supabase Authentication and Shared Tickets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add invite-only email/password authentication and move ticket and custom-category persistence from browser storage to one Supabase database shared by the team.

**Architecture:** Keep the current vanilla JavaScript interface and its tested ticket rendering logic. Add Vite as a build layer for Supabase JS and public build-time configuration, a small client-side data/auth adapter, and a SQL migration with authenticated-only RLS. Store one ticket per database row and custom categories in a shared table; do not import local demo records or enable a local ticket fallback.

**Tech Stack:** JavaScript, Vite, pnpm, `@supabase/supabase-js`, Supabase Auth, PostgreSQL/RLS, Render Static Site, Node built-in test runner and a focused pgTAP policy check.

**Spec:** [2026-11-02-auth-supabase-design.md](../specs/2026-11-02-auth-supabase-design.md)

## Global Constraints

- No public account registration; users are created/invited from Supabase.
- All authenticated teammates have the same ticket and custom-category permissions.
- Unauthenticated users have no access to the app data or exposed tables.
- The new database starts with no tickets; no existing `localStorage` tickets or categories are imported.
- Standard catalog categories remain in code; custom categories and tickets are shared through Supabase.
- Problem-analysis annotations remain local in this stage; its aggregate charts use shared tickets.
- No service-role key or other secret is shipped in client code or committed.
- Do not add a silent local persistence fallback for shared tickets or custom categories.
- Keep the current Spanish UI, workflows, status rules, priorities, charts and metrics.
- Do not deploy or create the Supabase project as part of implementation; document the user-run setup steps.

## Review Focus

- **Expired or absent session:** the login must replace all Service Desk content; protected data requests must fail closed. Pin with an auth-guard test and an RLS deny test for `anon`.
- **Empty new database:** initial load must show an empty ticket queue and never seed demo tickets. Pin with a repository/bootstrap test.
- **Concurrent ticket creation:** simultaneous requests must receive distinct IDs. Pin with a SQL sequence/default test and repository insert test.
- **Concurrent edits:** an update based on stale `updated_at` must show a conflict/reload message and must not overwrite newer data. Pin with a repository test.
- **Database/network failure:** failed writes must preserve form input and show an error, without a success toast or local-only mutation. Pin with app integration tests for ticket create, update, status change, comment, and category save failures.

---

### Task 1: Add Vite, pnpm and client configuration

**Files:**
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `vite.config.mjs`
- Create: `src/main.js`
- Create: `src/supabase-client.mjs`
- Create: `tests/supabase-client.test.mjs`
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `index.html`
- Modify: `render.yaml`
- Modify: `README.md`

**Interfaces:**
- `src/main.js` creates one Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, exposes it to the app bootstrap, then loads the application.
- Local development reads ignored `.env.local`; production build receives the same two public configuration values from Render.

- [x] **Step 1: Write the Supabase client configuration tests**

Add tests named `missing public Supabase config fails with a setup message` and `valid public Supabase config creates one client` for exported `createSupabaseClient(env, createClient)`.

- [x] **Step 2: Run the check and confirm it fails**

Run: `node --test tests/supabase-client.test.mjs`  
Expected: FAIL because the client factory does not exist.

- [x] **Step 3: Add Vite and pnpm setup**

Pin the package manager in `package.json`, add Vite, `@supabase/supabase-js`, and the Supabase CLI, and set `dev`, `build`, `test`, and `test:db` scripts. Make `index.html` the Vite entry and build to `dist/`. Keep `app.js` as the existing classic script in `public/` so the VM-based business-logic tests remain usable; move it from the repo root and update test paths. In `src/main.js`, create the Supabase client, expose it to the app, and load the classic adapter and app scripts in order. Put config validation in the separately testable `src/supabase-client.mjs`. Import `styles.css` through the Vite bootstrap. Add the two `VITE_` values to `.env.example`, ignore `.env*` except `.env.example`, and set Render's build command to `corepack enable && pnpm install --frozen-lockfile && pnpm build` with `dist` as publish path. Declare the two Render variables as `sync: false` for dashboard entry.

- [x] **Step 4: Run the build check**

Run: `node --test tests/supabase-client.test.mjs`, `pnpm test`, and `pnpm build`  
Expected: PASS; `dist/` includes the HTML shell, CSS, application script and Supabase bootstrap.

- [x] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.mjs src/main.js src/supabase-client.mjs .env.example .gitignore index.html render.yaml README.md public/app.js tests/app.test.js tests/supabase-client.test.mjs docs/superpowers/specs/2026-11-02-auth-supabase-design.md docs/superpowers/plans/2026-11-02-auth-supabase.md
git commit -m "build: add Vite and Supabase client setup"
```

### Task 2: Create shared schema and authenticated-only RLS

**Files:**
- Create: `supabase/migrations/202611020001_shared_service_desk.sql`
- Create: `supabase/tests/shared_service_desk_rls.test.sql`
- Create: `supabase/config.toml`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- `tickets` stores one row per ticket and preserves every current field: identifiers, type/category, subject/description, requester, brand/order/channel, impact/urgency/priority, status/assignee/communication owner, timestamps, comments, first response, resolution, reopen count and priority-change timestamp.
- `custom_categories` stores `id`, `name`, `type`, `description`, `reporter`, and `owner`.
- `tickets` grants select/insert/update only to `authenticated`; `custom_categories` grants select/insert only. Both enable RLS and define explicit per-operation policies. The `anon` role has no table grants or policies.
- A PostgreSQL sequence starting at `1049` supplies unique `BV-####` ticket IDs so two teammates can create tickets concurrently without ID collisions.

- [x] **Step 1: Write database policy assertions**

Add `shared_service_desk_rls.test.sql` asserting that `anon` cannot select/insert/update/delete from either table, authenticated users can perform the allowed ticket and category operations, disallowed deletes/category updates are denied, ticket IDs are distinct for concurrent-style inserts, and invalid type/status/priority/category values are rejected.

- [ ] **Step 2: Run policy assertions and confirm they fail**

Run: `pnpm supabase start` then `pnpm supabase test db`  
Expected: FAIL because the migration and schema do not exist.

- [x] **Step 3: Add the schema migration**

Create the two tables with checks matching existing app values (`Incidente`/`Solicitud`; current six statuses; P1/P2/P3), JSONB comments defaulting to an empty array, UTC timestamps, unique `(type, lower(name))` category constraint, ticket/category indexes, the ticket ID sequence/default, explicit grants, RLS enablement and separate select/insert/update policies for `tickets` and select/insert policies for `custom_categories`, all for `authenticated` only. Do not seed any tickets or custom categories.

- [ ] **Step 4: Run database policy assertions**

Run: `pnpm supabase test db`  
Expected: PASS for unauthenticated denies, authenticated allowed operations, denied deletes/category updates, field constraints and distinct generated ticket IDs.

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/202611020001_shared_service_desk.sql supabase/tests/shared_service_desk_rls.test.sql README.md
git commit -m "feat: add shared service desk schema and RLS"
```

The migration and pgTAP assertions are committed. Docker's local API returned HTTP 500 on both start attempts, so the policy assertions remain unverified and Task 2 stays incomplete until `pnpm test:db` can run.

### Task 3: Add the data adapter for tickets and custom categories

**Files:**
- Create: `public/service-desk-data.js`
- Create: `tests/service-desk-data.test.js`
- Modify: `src/main.js`
- Modify: `public/app.js`

**Interfaces:**
- `window.ServiceDeskData.load()` returns `{ tickets, customCategories }` or throws a typed `ServiceDeskDataError`.
- `window.ServiceDeskData.createTicket(ticketWithoutId)` returns the inserted ticket including the database-generated ID.
- `window.ServiceDeskData.updateTicket(ticket, expectedUpdatedAt)` returns the saved row or throws `TicketConflictError` when `updated_at` no longer matches.
- `window.ServiceDeskData.createCategory(category)` returns the inserted custom category.

- [x] **Step 1: Write data-adapter tests**

Add three focused tests using a fake Supabase query client: `loads shared ticket and category rows`, `creates with the server ID and rejects stale updates`, and `duplicate category or database failure returns an error`.

- [x] **Step 2: Run adapter tests and confirm they fail**

Run: `pnpm test -- --test-name-pattern="shared ticket and category rows|server ID and rejects stale updates|database failure returns an error"`  
Expected: FAIL because the adapter module does not exist.

- [x] **Step 3: Implement the adapter**

Implement the listed methods against the `tickets` and `custom_categories` tables. Convert Supabase snake_case fields to the current camelCase ticket/category shape. On update, filter by both ticket `id` and prior `updated_at`; if no row is returned, throw `TicketConflictError`. Never write to `localStorage` or treat a failed request as success. Load this adapter before the application script from `src/main.js`.

- [x] **Step 4: Run adapter tests**

Run: `pnpm test -- --test-name-pattern="shared ticket and category rows|server ID and rejects stale updates|database failure returns an error"`  
Expected: PASS for mapping, create, update conflict, category uniqueness and propagated errors.

- [x] **Step 5: Commit**

```bash
git add public/service-desk-data.js tests/service-desk-data.test.js public/app.js
git commit -m "feat: add Supabase repositories for tickets and categories"
```

### Task 4: Add invite-only login, session restore, reset and logout

**Files:**
- Create: `public/service-desk-auth.js`
- Create: `tests/service-desk-auth.test.js`
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `public/app.js`
- Modify: `styles.css`

**Interfaces:**
- `window.ServiceDeskAuth.start(client, callbacks)` resolves the current session and reports subsequent auth changes.
- `window.ServiceDeskAuth.signIn(email, password)`, `sendPasswordReset(email)`, `updatePassword(password)`, and `signOut()` return promises and surface provider errors.
- The UI exposes no sign-up action and does not query ticket/category tables before a valid session is available.

- [x] **Step 1: Write auth and guard tests**

Add three focused tests using a fake Supabase Auth client: `signed-out session shows login without loading tickets`, `sign-in and sign-out change the guarded view`, and `password recovery sends reset and updates an existing account`.

- [x] **Step 2: Run auth tests and confirm they fail**

Run: `pnpm test -- --test-name-pattern="signed-out session shows login|sign-in and sign-out|password recovery sends reset"`  
Expected: FAIL because the auth adapter and guarded view are absent.

- [x] **Step 3: Implement auth adapter and UI**

Implement the listed methods with Supabase Auth. Load the auth adapter before the app. Add accessible Spanish login, reset-request and password-update screens, session restoration, auth-state handling, protected app initialization and logout. Configure the reset redirect from the current origin and provide clear success/error messages. Keep account creation disabled in the UI.

- [x] **Step 4: Run auth tests**

Run: `pnpm test -- --test-name-pattern="signed-out session shows login|sign-in and sign-out|password recovery sends reset"`  
Expected: PASS; the signed-out view contains no ticket data and a recovered session reaches the app.

- [x] **Step 5: Commit**

```bash
git add public/service-desk-auth.js tests/service-desk-auth.test.js index.html public/app.js styles.css
git commit -m "feat: add invite-only Supabase authentication"
```

### Task 5: Load and persist tickets and categories through Supabase

**Files:**
- Modify: `public/app.js`
- Modify: `public/service-desk-data.js`
- Modify: `tests/app.test.js`
- Create: `tests/service-desk-integration.test.js`

**Interfaces:**
- The authenticated bootstrap awaits `ServiceDeskData.load()` before the first dashboard render.
- Existing UI actions call repository methods before confirming success; in-memory state changes only after successful responses.
- Problem-analysis records continue to use their current browser-local key. No ticket/category repository function reads or writes a browser storage key.

- [x] **Step 1: Add app integration tests**

Add focused app checks for an empty bootstrap, loading shared tickets/categories, and changing state only after repository success; the repository tests cover server-generated IDs, category failures and stale updates. Keep the established create/update UI behavior and ensure those handlers close only after a successful database response.

- [x] **Step 2: Run the focused integration checks**

Run: `pnpm test -- --test-name-pattern="authenticated shared data|production bootstrap|state changes only after|concurrent edit conflict"`
Expected: PASS for empty startup, shared-data loading, DB-first updates, failure state preservation, and conflict recovery. This focused set was reduced after the user approved a smaller test scope.

- [x] **Step 3: Replace local ticket/category persistence**

Remove `STORAGE_KEY`, `CATALOG_STORAGE_KEY`, `loadTickets`, `persist`, `loadCustomCatalog` and `persistCustomCatalog` for the shared entities. Keep `seedTickets()` available only for the existing standalone unit tests if needed, but never call it from the authenticated app. Make create, edit, status confirmation and comments await repository responses; assign server-generated IDs; restore the prior state and retain user-entered form values on failure; show success notifications only after successful writes. Load custom categories into the catalog after authentication, and make category creation operate through the shared repository. Preserve problem-record local storage unchanged.

- [x] **Step 4: Run integration and existing application tests**

Run: `pnpm test`  
Expected: PASS for new integration tests and all current Service Desk behavior tests; no shared ticket/custom-category path calls `localStorage`.

- [x] **Step 5: Commit**

```bash
git add public/app.js public/service-desk-data.js tests/app.test.js tests/service-desk-integration.test.js
git commit -m "feat: persist tickets and categories in Supabase"
```

### Task 6: Document setup and verify the production build

**Files:**
- Modify: `README.md`
- Modify: `render.yaml`
- Modify: `.env.example`

**Interfaces:**
- README setup instructions cover local Vite development, Supabase project creation, applying the migration, creating/inviting accounts, disabling public sign-up, configuring local and Render redirect URLs, setting Render variables, and verifying first login.
- Render Blueprint builds the static app using pnpm and publishes `dist/`; the deploy remains a manual user action.

- [x] **Step 1: Document the operator setup**

Write the steps so credentials are entered by the project owner directly in Supabase and Render; do not request them through chat. Include the exact allowed redirect origins for `http://localhost:5173` and `https://bevstack-service-desk.onrender.com/**`. Explain that the publishable key is visible in the frontend and is safe only with the migration's RLS policies.

- [x] **Step 2: Run the automated verification**

Run: `pnpm test`, `pnpm build`, and `git diff --check`  
Expected: all tests pass, Vite emits `dist/`, and Git reports no whitespace errors. Live sign-in, reset-email and two-browser sharing checks remain in the manual setup below because no Supabase project was created for this implementation pass.

- [x] **Step 3: Commit**

```bash
git add README.md render.yaml .env.example tests/app.test.js
git commit -m "docs: explain Supabase and Render setup"
```

## Manual setup after code implementation

1. Create a Supabase project and apply `supabase/migrations/202611020001_shared_service_desk.sql` in its SQL editor (or with Supabase CLI).
2. In Supabase Auth, disable public sign-ups, add `http://localhost:5173/**` and `https://bevstack-service-desk.onrender.com/**` to allowed redirect URLs, then create/invite team accounts.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to `.env.local` for local development and to the Render static site environment; trigger a build after setting Render variables.
4. Run locally with `pnpm install` and `pnpm dev`, verify two authenticated browsers share tickets and categories, then deploy only when the user requests it.

## Self-review

- **Spec coverage:** Auth, password recovery, no registration, empty database, shared ticket/category operations supported by the existing app, local-only problem annotations, RLS, protected client configuration, error states, README and Render build are assigned to Tasks 1–6.
- **Step scan:** Each task begins with focused failing tests, implements the exact listed interfaces, reruns its checks, and ends with a small commit.
- **Type consistency:** The adapter returns the existing camelCase ticket/category objects; create returns the database-generated ticket ID; update requires the prior `updatedAt` for concurrency conflict detection.
- **Review focus:** Each of the five failure classes above maps to explicit tests and the task that owns that behavior.
- **Proportion:** Six tasks cover the approved design, with schema/auth/data/UI/config split by independently reviewable outcomes.

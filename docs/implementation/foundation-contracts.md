# Foundation contracts

These contracts apply to the current sample-backed foundation. Page design and real reporting integration are later milestones.

## Composition and imports

Routes compose account context, prepared sample values, and feature views. Feature views receive typed display models. Shared components must not know which repository, account store, GitHub collector, or report calculation produced a value.

`dependency-cruiser.config.mjs` resolves TypeScript aliases, relative imports, re-exports, and statically resolvable dependencies. It rejects source cycles, unresolved imports, shared-component dependencies on features, cross-feature imports, reversed pure-layer dependencies, and presentation paths that reach server/auth/AWS/sample modules or Node builtins. Package internals under node_modules are not traversed; this is a source architecture check, not a dependency security audit.

The separate retirement checker rejects known retired reporting paths, packages in either dependency section, obsolete scripts, raw-store strings, and computed module imports. Its AST scan covers application `.ts`/`.tsx` files. Runtime-generated code, arbitrary HTTP destinations, and third-party package internals are outside that check. Both checkers reject empty input. Positive and negative fixtures exercise the actual checkers.

## Table state ownership

- The URL owns search, sort direction, sort key, and page. Unknown sort keys and invalid page numbers normalize to safe defaults; repeated scalar fields consistently use the first value. Unrelated and repeated filter parameters survive serialization.
- Saved local preferences supply an account-specific initial sort only when the URL does not explicitly supply one. Invalid or denied storage must not block interaction. Local preferences are not server-synchronized account settings.
- Column visibility and export progress are temporary component state. Search/sort changes reset the page. Pages contain at most 100 rows.
- UI changes use history replacement to avoid a history entry per keystroke and preserve Next's existing history state. Browser back/forward updates the table and notifies the adapter. The adapter is also notified on mount. Equivalent queries do not trigger callbacks just because a callback or columns array gets a new identity.

For local samples, `rows` is the complete supplied population; search/sort precede pagination and export includes every matching row and all columns.

For externally paged inputs, `paging.query` identifies the query that produced **both** `rows` and `totalCount`. The table never repeats sorting/filtering/pagination on that single page. It hides results whose query does not match the current URL. A shrinking total requests a valid page rather than relabeling old rows. `pending`, `error`, and `onRetry` describe the current request; the controller must clear or supersede them with each request. Export receives the current full scope without a page number, may be asynchronous, and has a visible retryable failure state.

A future adapter owns request cancellation/order, response-schema validation, authentication, and loading errors. It must publish rows, total, and their query together and ignore obsolete responses. The table guards against mislabeling; it does not cancel network requests or make backend queries scalable. Database filtering, indexing, authorization, and full-scope export remain integration work.

## Runtime account boundaries

Account request bodies, consumed API responses, and loaded account/whitelist records are validated with Zod. Invalid user input returns 400; malformed store responses and store failures remain failures. Production credential validation checks whitelist membership, account existence, and password verification and returns only safe identity fields.

Account mutations reject preview builds before invoking real authentication/storage. Admin mutations also require an administrator and completion of mandatory password changes. Password change acts on the authenticated identity, never a user ID supplied in the body. API checks are independent of page-layout checks.

Production Auth.js handler tests use real CSRF/session-cookie processing with controlled account dependencies. They do not contact AWS or prove the deployed Amplify configuration. JWT role/password-change claims are still captured at sign-in; immediate session revocation and existing-session behavior after administrative resets are retained limitations requiring a production-auth review. User creation and whitelist updates remain separate writes; account uniqueness/concurrency is not redesigned here.

Public first-admin setup remains an explicit unresolved production gate. See [the decision brief](account-bootstrap-decision.md); do not treat a passing preview or production build as permission to expose that setup route.

## Verification policy

`npm run check` runs formatting, type-aware lint, strict app/test/tool typechecking, both architecture/removal checks, and unit/component tests with coverage. `npm run check:all` additionally runs a full dependency audit, a production-auth build, a preview build, Storybook, and Chromium/WebKit browser tests. CI invokes that same command.

Coverage includes all application TS/TSX, excluding declarations. Thresholds are per file within explicitly listed critical groups: presentation helpers, table/query state, credential/access/request policies and auth wiring, and admin/password API handlers. The report also exposes uncovered scaffolds, retained admin screens, UI primitives, and store mutations. There is no claim of whole-application coverage or a blanket percentage that conceals those gaps. Browser execution is reported separately from unit coverage.

Required suites must select tests and report no failures/skips. Browser assertions cover actual values, URL behavior, keyboard/theme/style behavior, export bytes, and preview restrictions; screenshots are inspection artifacts, not approved design baselines. Offline storage tests do not claim a live service integration. Same-author verification does not replace independent review.

# Authentication landing-page review

This follow-up adds the centered Prebid sign-in and password-setup designs, shared System / Light / Dark controls, and the six-character password policy. It is stacked on PR #2 at `6daf178de6c0c0da76aaa9dc5abf3fbcbe32db86`; the foundation's review and deployment acceptance remain separate.

Initial audited head: `a39009c7f66bbd1d7307e1c6c23f1dae3b5a9f21`.

Verified code/test checkpoint: `b2bf9ae0e6077003d8080505b9471eb55c95c678`. The following handoff commit adds this report and evidence only. [The input manifest](evidence/login-landing/source-manifest.json) binds the executable sources, tests, build/configuration inputs, and public assets to that checkpoint; [the receipt](evidence/login-landing/verification.json) records the completed local run. Hosted results belong to the final PR head and are reported by GitHub Checks.

## Corrections and regression evidence

All items below are fixed in the checkpoint. Locations refer to the final implementation; the tests contain the reproducible scenarios. The initial unit regressions failed before the corresponding changes. Native GET submission was reproduced with an actual button click and synthetic credentials in both browser engines.

| ID | Severity / origin | Mechanism and correction | Verification |
| --- | --- | --- | --- |
| LL-01 | P1, introduced by named form fields | Without JavaScript, the sign-in form's default GET submitted credentials in the query string. Both auth forms now explicitly use POST, and the auth layout supplies a no-script notice. This prevents URL serialization; it does not implement JavaScript-free authentication. | [Login form](../../src/features/authentication/login-view.tsx#L79), [password form](../../src/features/authentication/change-password-view.tsx), [native browser submission](../../tests/e2e/auth-native-submit.spec.ts). The regression checks the actual request method, URL, and POST body. |
| LL-02 | P2, inherited sign-in lifecycle gap | A delayed successful sign-in could navigate and broadcast after its form was disposed. The view now owns each operation and ignores obsolete success, error, and cleanup continuations. | [Operation ownership](../../src/features/authentication/login-view.tsx#L28), [resolved and rejected post-disposal cases](../../tests/components/login-view.test.tsx). |
| LL-03 | P3, inherited sign-in lifecycle gap | A second submit event during an outstanding request invoked Auth.js again; disabling the button did not guard the handler. The same operation owner now rejects duplicate dispatch. | [Pending-submit guard](../../src/features/authentication/login-view.tsx#L37), [duplicate submission regression](../../tests/components/login-view.test.tsx). |
| LL-04 | P3, introduced component API gap | `PasswordInput` accepted `className` but replaced it, preventing caller styling. It is now a shared UI primitive that merges styles, forwards native props and refs, and generates a unique id when omitted. Both auth views use it; the feature-local copy is removed. | [Shared primitive](../../src/components/ui/password-input.tsx), [native props/ref, independent controls, disabled and keyboard behavior](../../tests/components/password-input.test.tsx). |
| LL-05 | P2, retained length-counting gap | UTF-16 string length counted three astral symbols as six. Minimum length now counts Unicode code points. The intended minimum remains six, with no case/number/symbol rules, and the 72-byte hashing bound is unchanged. | [Policy](../../src/models/password-policy.ts#L8), [Unicode and byte-boundary cases](../../tests/unit/password-policy.test.ts), six-character passwords in the production account flow. |
| LL-06 | P2, inherited navigation gap | The forced password-change redirect discarded a filtered return destination; successful setup and manual recovery then defaulted to All Repos. The sanitized destination now survives the server redirect, route composition, automatic sign-in, recovery sign-in, and back-to-sign-in link. Destination authorization remains server-enforced. | [Viewer redirect](../../src/lib/auth/viewer.ts#L93), [route composition](../../src/app/auth/change-password/page.tsx), [password flow](../../src/features/authentication/change-password-view.tsx#L85), [safe/recovery component cases](../../tests/components/change-password-view.test.tsx), [production browser round trips](../../tests/production/browser.test.ts). |

An already-sent Auth.js request can still change its cookie after the view is disposed. The view's cancellation guards prevent obsolete UI continuations; they cannot undo a committed server action. Password-change request cancellation retains the same limit for a write that has already committed.

## Reusable architecture

- The existing root `ThemeProvider` remains the only app owner of browser preference detection, storage, and cross-tab synchronization. `ThemeMenu` is adopted at both eligible layout controls: auth and dashboard. No form implements separate theme persistence or media-query listeners.
- The menu renders a stable disabled trigger before mounting. It uses the existing Radix primitive, stays within its owning landmark, is nonmodal, and removes its closing animation so a theme transition does not retain stale menu content. Other dropdowns retain their existing default portal behavior.
- `PasswordInput` is independent of feature styles and password policy. It is used by both auth forms, covering all four eligible password fields. The shared `Input`, `Button`, and `Label` remain the underlying primitives.
- `AuthFrame` and the authentication palette remain feature-specific. The approved visual direction and reuse boundary are documented in the [product definition](../product/login.md#reuse-for-future-pages). This PR does not globally restyle the dashboard or introduce a new design-system dependency.
- Route composition supplies current account identity and return context. Password validation has one shared model used by the form and server. The existing current-viewer, CSRF/origin, account-transaction, and credential-expiry boundaries remain intact.
- Storybook uses the actual theme provider. Its toolbar applies only deliberate catalog-theme changes, so its initial selection cannot overwrite a subsequent choice through the page menu.

## Verification and coverage

The complete `npm run check:all` passed on Node 24.22.1, npm 11.19.1, macOS ARM64, and OpenJDK 21.0.11:

| Layer | Individually passing cases |
| --- | ---: |
| Unit/component | 287 |
| DynamoDB Local integration | 27 |
| Packaged-production HTTP/browser | 5 |
| Chromium/WebKit preview and catalog | 40 |
| Total | 359 |

There were no failed, skipped, pending, expected-failure, or flaky cases. The result validator checks the individual machine-report entries and counts. Formatting, lint, types, architecture/removal boundaries across 104 application files, both application builds, Storybook, and the full dependency audit passed; npm reported zero advisories.

The two authentication views, `PasswordInput`, `ThemeMenu`, and the password-policy model each measured 100% lines, statements, functions, and branches, with matching per-file gates. This is coverage of those TypeScript modules, not a claim of exhaustive behavior or 100% coverage for the entire application.

Complementary browser checks exercise real provider storage/media-query behavior, manual overrides and reloads, returning to System, keyboard/focus behavior, cross-tab and cross-page consistency, feedback contrast, and both themes at desktop, tablet, and narrow-phone widths. SSR/hydration cases verify that a saved preference does not replace server markup. Production cases use the built artifact and real isolated DynamoDB transactions, including filtered return navigation after temporary-password replacement and confirmed-write recovery.

No unresolved change-specific finding remains from this self-audit. Independent reviewer approval is still required; passing checks are not approval or merge authorization.

**Ran:** `npm run check:all` at the code/test checkpoint above, plus the documented regression reproductions. All selected checks completed successfully.

**Not-run:** physical mobile/tablet and native password-manager acceptance; live Amplify/IAM, shared hosted login throttling, production migration or deployment; independent reviewer approval. The foundation's [deployment prerequisites](account-operations.md#ordered-deployment-and-rollback) remain release requirements.

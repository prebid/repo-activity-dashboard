# Live-site login workaround

This branch targets the current Next.js 14 site at `main.d2x8rtiv281f4g.amplifyapp.com`, based on current main at `f59e4dadecebe42bd2427f239e176afb9e2f84b6`. It does not deploy the sample-backed reporting foundation in PR #2.

## Behavior

- Signed-out visits to reports go to the approved Prebid sign-in design. Existing administrator-created accounts and temporary-password changes use the current Auth.js/DynamoDB account system.
- Dark is the default. Existing `dashboard-theme` preferences are preserved; Light and System remain available.
- Report views retain their existing calculations and controls. The existing `store` source remains the build input. Build preparation copies it to `report-data` and generates an ignored, server-only module containing the report files and timeline with unchanged bytes. Authenticated, noncached Node routes read this bundle; they do not depend on source files being present in the deployed server's working directory.
- Large timeline data is delivered in bounded parts with a common version, then reconstructed before rendering the unchanged report views.
- Existing administrators can continue creating users. Public first-admin setup and diagnostic endpoints are retired; setup directs administrators to user management.

## Design consistency and eventual cutover

PR #3 is the visual reference. Scoped CSS supplies input padding, visibility-button positioning, sizing, and box sizing that the old styling pipeline does not reliably provide. These are compatibility rules, not a separate design direction.

Keep the workaround serving production until replacement reports and data are ready. Merging PR #2 alone is not the production cutover. Before merging the redesign into a production-tracked branch, confirm and control Amplify auto-build behavior so current reports are not replaced prematurely.

At the full cutover:

1. Retarget/reconcile redesign branches against current main and re-review the resulting diff.
2. Preserve the approved Dark default and retain `dashboard-theme` or explicitly migrate its saved choice. PR #3 originally defaulted to System; reconcile that before deployment.
3. Remove the legacy report views, private-file adapters, and legacy-only CSS as replacement pages adopt foundation components. Do not carry duplicate account writers into production.
4. Follow the foundation's account-migration/reissue and deployment acceptance procedure. This workaround retains legacy account/session semantics; it does not implement PR #2's revision checks or temporary-password expiry policy.
5. Repeat light/dark, responsive geometry, sign-in/password-change, and report-data checks against the actual deployed build.

## Verification

`npm run verify:live-login` builds with synthetic local settings, runs focused unit checks, and exercises Chromium/WebKit against isolated in-memory DynamoDB Local. It never uses live account tables or runs the live S3 sync. Its build artifact is for verification, not deployment.

The browser server runs from a temporary directory containing only the built `.next` output, public assets, package/config files, and dependencies. It has no `src`, `store`, `report-data`, or source timeline. This reproduces the missing-source-file condition that broke report loading after the initial Amplify deployment. The server-only bundle is generated before development, normal builds, and the verification command; it must never be copied to public assets.

Browser cases cover anonymous page/data denial, administrator sign-in and user creation, temporary-password replacement, existing reports, exact report-file equality, complete timeline/mapping reconstruction, absence of report data from public assets/client bundles, and input/icon geometry in both themes at phone/tablet/desktop widths.

For real deployment, use the normal Amplify build with existing production configuration. Then verify the root entry and direct report URLs anonymously, check that direct `/store/...` and `/api/report-data` requests are denied, and use the existing administrator and newly created user to confirm report/password flows. Check for stale CDN responses and invalidate them if needed. The gate does not erase previously downloaded data or make public repository history private.

Amplify app/branch metadata is not verified: the available AWS identity was denied `amplify:GetApp`. No cloud configuration, live account, or production deployment was changed while preparing this patch.

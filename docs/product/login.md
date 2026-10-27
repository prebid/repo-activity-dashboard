# Login landing page — product definition

This document records the approved login design and behavior for the frontend rebuild.

## Purpose

Provide the application's login entry point using the existing authentication approach. This work does not introduce a new sign-in provider, account-registration model, or recovery system. Existing account eligibility and recovery behavior are retained.

## Post-login navigation

| Entry path | Successful login destination |
| --- | --- |
| Normal visit to the login page without an intended destination | All Repos. |
| A repository page or filtered application link that requires login | The original application view, preserving its repository, selected list, filters, timeframe/date basis, sorting, and pagination context where supplied by the link. |

An explicit filtered return destination takes precedence over saved defaults and the repository page's unfiltered Current open default.

Return destinations must be valid application destinations available to the signed-in account. An invalid or inaccessible destination falls back to All Repos; login does not bypass access checks or redirect to an arbitrary external URL.

A failed sign-in stays on the login page with an appropriate error and retains the intended destination for a later successful attempt.

## Related pages

- [All Repositories](all-repositories.md)
- [Repository page](repository-detail.md)
- [Agents and bots tracking page](agents-and-bots.md), with specific-user access to be configured through the existing login during integration. Permission-management and launch controls are not part of the initial tracking frontend.

## Login and password-setup design

The selected direction is a polished, centered sign-in card with Prebid branding and an inviting, restrained layout. The rebuild preserves the live login design on the upgraded foundation.

The login and password forms share the logo, card, typography, field styling, and primary action. The logo has no subtitle, and the sign-in card starts directly with “Sign in,” without a separate product label. Password visibility controls support keyboard use. First-time guidance explains signing in with an administrator-issued temporary password and choosing a new one before entering the dashboard. Access and recovery remain administrator-managed; the page does not introduce self-registration or an email-reset service.

Password setup shows the temporary password, new password, and confirmation without a visible account/email line. Following the 2026-10-26 direction to avoid password complexity for internal users, the shared client/server policy requires at least 6 Unicode code points without uppercase, lowercase, number, or symbol rules. The form shows one short length hint instead of a checklist. The existing 72-byte hashing limit remains enforced without truncation. The form preserves the foundation's confirmed-write recovery: if automatic sign-in fails after the password is saved, login explains that the new password is ready to use. Production has empty login fields; synthetic credentials remain confined to explicit preview mode.

Storybook's Authentication / Pages group provides sign-in, password-change confirmation, temporary-password setup, and ordinary password-change views. This work simplifies the shared new-password policy but does not change the authentication store, temporary-credential lifecycle, or deployment acceptance requirements.

## Appearance

Authentication and dashboard layouts share one System / Light / Dark menu. Dark is the default, matching the live-site refinement.

- The existing root `ThemeProvider` owns theme detection and persistence. The existing `dashboard-theme` preference is preserved. An explicit System choice follows the browser's reported color preference, including changes while the page is open. Explicit Light or Dark choices override that preference until System is selected again.
- `ThemeMenu` is a shared layout component, used by the authentication layout and dashboard toolbar. Forms do not manage theme state. The preference is browser-local and remains consistent across navigation, reloads, and same-origin tabs; it is not an account setting synchronized across devices.
- Authentication colors are semantic variables scoped to its surface, with light and dark values selected by the provider's root class. Dashboard components retain their existing theme tokens. Storybook uses the same provider and offers all three choices.
- The menu waits for client mounting before exposing the saved selection, preserving a stable server render. The provider retains responsibility for applying the initial theme before hydration.
- Verify automatic changes, saved overrides, returning to System, keyboard selection, cross-page/tab consistency, and contrast in normal, success, and error states. Check both forms at desktop, tablet, and narrow-phone widths in Chromium and WebKit.

## Reuse for future pages

Carry forward the Prebid branding, restrained blue/slate surfaces, orange primary actions, rounded cards, and paired light/dark colors. Keep layout density appropriate to each page.

- Shared `Button`, `Input`, `Label`, and `PasswordInput` primitives remain independent of authentication. `PasswordInput` preserves native input props, caller styling, and refs; its generated ids associate each visibility control with its own input.
- The authentication view composes those primitives and applies its palette through scoped semantic variables. `AuthFrame` stays authentication-specific. Future features should reuse shared primitives and promote genuinely shared palette roles rather than import another feature's stylesheet.
- `ThemeMenu` and the existing root provider remain the single theme-control path across layouts. New controls must not introduce their own storage or media-query listeners.
- Required password setup and recovery after a confirmed password change preserve a sanitized return destination. Server authorization is still enforced at that destination.
- Sign-in requires JavaScript. Native forms use POST so a missing script cannot serialize credentials into the URL; the no-script view explains how to continue. Disposed forms ignore late completions, but an already-sent Auth.js request cannot be cancelled or its cookie effects undone by the view.

## Delivery boundary

Login and subsequent page work integrate through `codex/frontend-rebuild`. Production `main` continues serving the existing dashboard until the replacement is ready for a separate cutover. Reporting remains synthetic during frontend development; retain the foundation account, recovery, and deployment contracts.

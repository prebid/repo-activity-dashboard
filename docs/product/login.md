# Login landing page — product definition

Status: page purpose, post-login navigation, and retention of the existing authentication approach agreed on 2026-10-24. This document defines behavior; it does not implement authentication.

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

On 2026-10-26, the selected direction was a polished, centered sign-in card with Prebid branding and an inviting, restrained layout. The implementation is isolated on `codex/login-landing`, based on PR #2's foundation at `6daf178de6c0c0da76aaa9dc5abf3fbcbe32db86`.

The login and password forms share the logo, card, typography, field styling, and primary action. The logo has no subtitle, and the sign-in card starts directly with “Sign in,” without a separate product label. Password visibility controls support keyboard use. First-time guidance explains signing in with an administrator-issued temporary password and choosing a new one before entering the dashboard. Access and recovery remain administrator-managed; the page does not introduce self-registration or an email-reset service.

Password setup shows the temporary password, new password, and confirmation without a visible account/email line. Following the 2026-10-26 direction to avoid password complexity for internal users, the shared client/server policy requires at least 6 characters without uppercase, lowercase, number, or symbol rules. The form shows one short length hint instead of a checklist. The existing 72-byte hashing limit remains enforced without truncation. The form preserves the foundation's confirmed-write recovery: if automatic sign-in fails after the password is saved, login explains that the new password is ready to use. Production has empty login fields; synthetic credentials remain confined to explicit preview mode.

Storybook's Authentication / Pages group provides sign-in, password-change confirmation, temporary-password setup, and ordinary password-change views. This work simplifies the shared new-password policy but does not change the authentication store, temporary-credential lifecycle, or deployment acceptance requirements.

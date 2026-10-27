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

Exact visual design and sign-in controls follow the existing authentication method. No application behavior has been implemented or verified by this document.

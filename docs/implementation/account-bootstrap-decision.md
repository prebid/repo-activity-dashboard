# First administrator: pending decision

Status: **recommendation only; no provisioning command has been implemented and public setup has not been disabled.** The user requested a clearer explanation before choosing. This must be resolved before a real deployment exposes account setup. It does not block credential-free preview development.

## What the three account flows mean

1. **First-admin setup** creates the initial administrator in a new environment when nobody can sign in yet.
2. **Normal sign-in** authenticates an existing account with its password.
3. **Account administration** allows an authenticated administrator to create/reset other accounts. These receive temporary passwords and must change them on sign-in.

The existing public setup accepts a whitelisted email and a chosen password, but does not verify ownership of that email. Knowing an approved address is not proof of identity. This is specific to bootstrapping; it is not a proposal to replace normal login or recreate existing users.

## Recommended flow: operator provisioning

An operator is the person responsible for the AWS deployment, already authorized to access its account tables. An ordinary user does not run commands or receive AWS access.

The proposed change closes the public setup form and its write/status endpoints. The deployment owner selects the target environment and runs a documented command using their authorized AWS identity. The command creates the initial administrator and a temporary password, refuses accidental overwrite, and requires a password change at the first website login. The operator transfers that temporary password privately to the intended administrator. Afterward, administrators use the protected website to create other accounts.

Existing accounts and normal sign-in remain in place. A second environment needs its own initial administrator. Lost access requires a documented operator recovery procedure; it should not reopen public setup.

This is a small deployment tool, not a new reporting database or a command every user runs. Implementation needs tests for target/config validation, refusing existing accounts, concurrent/repeated invocation, failure recovery, no secret logging, and the mandatory password change. Exact storage/write mechanics should be decided when this option is accepted, rather than silently assuming scan-then-write is atomic.

## Alternatives

| Approach | User experience | Additional responsibility |
| --- | --- | --- |
| Operator provisioning (recommended) | Deployment owner creates the initial account; administrator signs in with a temporary password. | Operator access, private credential transfer, repeat-safe provisioning, recovery documentation. |
| Public form with a one-time secret | Deployment owner privately supplies a secret; the first administrator enters it in the setup form. | Secret generation/storage/distribution, request protection, atomic one-time consumption, expiration and recovery. A shared secret authorizes bootstrap; it does not itself verify email ownership. |
| Verified identity provider | Administrator signs in through an organization identity provider or a verified invitation flow. | Provider configuration, identity/account linking, role assignment, recovery, and an authentication migration. Worth considering if organization-wide identity is a requirement. |

The recommendation favors operator provisioning because account creation is controlled and first setup is infrequent. If self-service organization onboarding becomes a requirement, revisit verified identity rather than expanding a one-time bootstrap form into an account platform.

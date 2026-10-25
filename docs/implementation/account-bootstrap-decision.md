# First administrator — implemented decision

Operator-controlled provisioning is implemented. The public setup form and its write/status endpoints are closed. Normal sign-in remains in place, and administrators create/reset other accounts through protected APIs.

The operator command uses explicitly named AWS table targets, writes the generated temporary credential to a new private file before mutation, and atomically creates the initial account, unique email claim, and bootstrap marker. Concurrent/repeated setup cannot create a second initial administrator. The first administrator must choose a different password on sign-in.

Existing accounts are retained. A repeat-safe migration adds email-to-account links; dry-run validation precedes writes. Controlled creation, reset, access changes and inspection support recovery without reopening public setup.

[Commands, configuration and recovery](account-operations.md) · [Current foundation status](quality-foundation-status.md)

The preceding discussion and alternatives remain in Git history. This is the implemented behavior, not a pending choice for the reviewer.

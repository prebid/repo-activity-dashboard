# Agent launching — deferred reference notes

Status: launching agents is the last planned feature, after the tracking frontend and its data integration. These earlier execution proposals are retained as reference, not as required first-phase UI or settled policy. Launching remains limited to existing defined agents; creating agents or deploying new versions remains outside scope.

Access will eventually use specific logged-in users, with allowed scope primarily defined by repositories. Exact users, limits, PR eligibility, revision-change handling, and launcher behavior can be resolved with the execution integration. They do not block the tracking UI.

The [Agents & bots specification](agents-and-bots.md) owns the tracking-first scope. No Run, Cancel, Retry, permission-management, or launch-policy controls are required in its first frontend version.

Follow the [approved delivery sequence](README.md#approved-delivery-sequence). Early deployment of sample-backed reporting does not move agent launching into the frontend milestone.

## Run agent flow

When the deferred launching feature is implemented, keep its first version focused:

1. Choose an existing, connected agent definition available to the operator.
2. Choose the repository and PR, or paste a PR link that resolves to an allowed repository.
3. Show the resolved PR title/state/revision, selected agent, and a plain-language summary of its already-configured behavior and external actions.
4. Start the run and show its accepted run record, then its execution status.

No generic prompt, model, tools, or capability editor is part of this flow. Existing required agent inputs can be supplied through the predefined integration, but this page cannot expand the agent's permissions.

A proposed shortcut on repository PR rows opens the same flow with the target prefilled. The PR title/number itself still opens GitHub. Both entry paths use identical authorization and target validation.

Launching an agent and changing/deploying its definition are separate actions; only launching an existing definition is in scope. Show the agent's configured publication behavior before Start. If the existing workflow publishes automatically, use its authorized policy; do not invent a universal second approval step. If it stages results for approval, represent that stage explicitly.

## Access and authority

Start with explicitly designated accounts/capabilities for:

- **View operations:** catalog, permitted run summaries, and approved log/artifact access.
- **Run operations:** start runs on allowed agents/repositories; cancellation or retry only where the connected runner and policy support them.

The same people may hold both capabilities. Contribution-group editor permissions do not automatically grant either. Existing agent configuration management remains outside this page.

Check authorization on the backend for run creation, run/log retrieval, artifact access, and any control operation, including direct URLs. Hiding a navigation item or button is not sufficient. The authenticated requester is recorded by the service, not accepted as an arbitrary client-supplied identity.

The effective permission set is limited by the operator's allowed scope and the existing agent definition. Commenting, requesting changes, approving, pushing commits, and merging are distinct capabilities; selecting an agent must not silently grant extra ones. This page reflects configured capabilities rather than offering new privilege toggles.

Credentials remain outside browser forms, exported metadata, and logs. PR text/code and agent output are untrusted task material and cannot change the approved launch configuration or credential scope. Existing execution isolation and credential controls must be checked when wiring a launcher; the page itself does not establish them.

## Target changes and duplicate launches

Resolve and record the target PR revision when accepting a run. Also capture the configured primary/base branch context needed by the existing agent. Do not silently retarget an accepted run to a later commit.

If the PR changes while the job runs, show the result as applying to the recorded revision. Distinguish the requested revision from the actual analyzed revision when the runner reports it; do not claim exact-revision execution based solely on the initial request. Before approving or writing changes, the connected workflow must enforce its target-freshness rules. It must not silently publish approval or apply changes as though old analysis covered new code.

Deduplicate retries of the same launch request so double-clicks or browser/network retries do not create several logical runs. Deduplication is based on the launch-request identity, not the agent, model, PR, or revision. Show matching active runs as context while allowing an intentional additional launch with a new request identity. A reused request identity with different parameters must not silently change the original run.

An explicit rerun creates a linked run record. Clearly distinguish rerunning the original revision from starting on the latest revision. A dispatch with unknown outcome must be reconciled with the runner before blindly trying again; an API timeout does not prove no execution started.

## Limits and operational context

Display and respect the existing agent's configured timeout, concurrency, retry, and usage limits where enforced. The browser is not the enforcement mechanism. Do not promise a hard financial cap or reliable per-run cost where the runner cannot provide it.

Run history should survive navigation away from the page. Retain who requested each control action and the resulting state/outputs. Define log/artifact retention when integrating a runner; expired content should be labeled expired, not mistaken for a run with no output. Prefer existing native trace/log viewers over building a full observability product in this dashboard.

## References and remaining integration inputs

GitHub Actions is an example of a possible adapter, not a selected runner: its APIs support workflow dispatch, run/attempt retrieval, cancellation, and log access. Cancellation acceptance and confirmed terminal execution state are separate. Sources: [workflow dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event), [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs).

If GitHub App authentication is used, installation access is bounded by granted repositories and permissions; that integration choice is also not made here. Source: [GitHub App installation authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation).

Before real execution is enabled, supply the named agent definitions, their launch integrations, permitted operator accounts/repositories, available lifecycle/output metadata, and the existing agent publication behavior. This planning task has not inspected or changed those agents or started any runs.

## Deferred execution fixtures

- Duplicate delivery of one launch request creates one logical run; intentional identical launches remain distinct.
- Multiple runs on one PR can coexist within the actual runner's capacity.
- Cancellation affects only the selected run and does not undo published output.
- Dispatch uncertainty, unavailable launchers, target changes, and concurrent writes are handled according to the eventual integration's policy.
- Launch controls enforce the configured login-based and repository-scoped access.

No execution service has been connected or agent run started by these notes.

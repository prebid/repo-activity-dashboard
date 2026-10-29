# Agents and bots — tracking-first page draft

Status: tracking is the primary frontend scope, as clarified on 2026-10-24. Launching existing agents is the last feature to address. Access will eventually be assigned to specific users through login, with scope primarily defined by repositories. Launch permissions, PR eligibility, and revision-change policies are not current frontend decisions. Existing agents sometimes run through Codex or Claude Code on local machines; no runtime integration has been verified.

## Confirmed purpose

- Let authorized people see the available Prebid agents and other bots, their relevant activity, and recorded agent runs.
- Eventually let permitted users start existing defined agents within configured repository scope. Launch controls are deferred until tracking and data integration are established.
- Track multiple independent runs on the same PR, including different models and repeated instances of the same agent/model combination. Preserve each run separately, regardless of whether it was launched manually, elsewhere, or eventually through this app.
- Reuse the existing classification of mapped Prebid agents versus other GitHub-identified bots.
- Use the existing agent's behavior and permissions; this page does not create agents, edit their prompts, choose models, or deploy new agent versions.
- Keep charting on repository pages. This operations area uses tables, run details, and execution status.

## Delivery priority

1. **Tracking frontend:** agent/bot tables, repository filters, historical GitHub activity, recorded runs, model/harness metadata, result/status information, and available output links. Use explicit fixture data first.
2. **Tracking integration:** connect available activity/run sources and apply the existing login with configured user/repository access. Exact identities and storage/connection details can be supplied during integration.
3. **Launching — last:** add starting existing agents and any supported execution controls. Earlier control proposals are retained in [deferred launching notes](agent-launching-deferred.md).

Do not make a working launcher, permission-management screen, PR-eligibility policy, or target-revision policy a prerequisite for designing the tracking page. The first version has no launch/cancel/retry controls. Agent creation, new capabilities, and deployment/version-management tools remain outside scope.

## Agent, harness, model, account, and run identity

Keep these distinct:

| Object | Meaning |
| --- | --- |
| Agent definition | A named existing agent with a known purpose and available metadata. Record its version/configuration reference when available; a connected launcher is not required for tracking. |
| Harness | The software that executes and coordinates the agent, such as Codex or Claude Code. Record its version when available. |
| Model | The model used by the harness. Opus, Fable, GPT-Astra, and Jev are model names in this discussion; keep the friendly label separate from the exact provider/model identifier reported for a run. |
| GitHub account | The identity that authors GitHub actions. Several agent definitions or manual sessions may use the same account. |
| Run | One recorded execution with its own unique run ID and source context, including runs started outside this app. Agent, model, and PR do not together form a unique run identity. |
| Attempt | An execution attempt within a logical run, if the runner retries. Preserve attempts without confusing them with separate user requests. |

Agent type and operational control are also different dimensions. A mapped Prebid agent can be unconnected to a launcher; an external bot can have visible GitHub activity without exposing internal runs or control APIs.

Show tracking coverage explicitly: recorded run data connected, GitHub activity only, or unavailable/unknown. Control availability is a later concern. An observed bot's lack of runtime data is not proof that it is idle, offline, or has never run.

### Model and harness metadata

Keep agent purpose, harness, model, provider, execution location, and GitHub publishing identity as separate fields. Changing a model does not inherently create a new agent purpose or GitHub account. Supported combinations come from the existing agent definitions; this structure does not imply every model can run in every harness.

- The catalog displays the configured harness and model for each existing agent definition, read-only.
- A run captures its requested/configured model and harness, the reported model actually used when available, and their version/configuration references. Historical run records must not change when an agent's defaults later change.
- Preserve the friendly model name, exact raw model ID/version when supplied, and provider. A family name or alias alone does not establish an exact version.
- Optional model-category metadata can describe distinctions such as **System 1**. The user identifies Jev as a System 1 model. This is a model attribute, not a harness name or a per-run reasoning-effort setting.
- Capture relevant native settings such as reasoning effort only when supplied by the configured runner; do not infer them from a model name or equate settings across providers.
- If fallback, delegation, or different attempts use multiple models, show that the run used multiple models and retain the per-step/attempt attribution in details. Do not present the configured starting model as the sole observed model.
- Model and harness fields in historical GitHub-activity-only records remain unknown unless reliable run metadata establishes them. A GitHub username or an agent's self-description alone is not enough.
- Display a dash for unavailable values. If an integration explicitly identifies automation as not model-based, distinguish that explanation from missing telemetry in supporting text; do not infer it merely from the bot category.

Model/harness metadata may be shown, filtered, and included in run-history exports. No model picker, harness picker, prompt editor, new agent variants, or capability changes are introduced into the launch flow. Operators select an already-defined agent whose existing configuration supplies these values.

### Multiple runs on one PR

A PR can have many independent runs, including several of the same agent, several using the same model, and runs using different existing model configurations. This remains true when their target revision is identical. Running one agent does not reserve the PR for that agent or implicitly replace a previous run.

Each run retains its own agent/configuration reference, recorded harness/model, target revision, requester, status, timings, artifacts, and GitHub output references. Completion or cancellation of one run does not complete or cancel other runs on that PR.

Keep independent launches distinct from retries/attempts within a run and from a single run that internally uses multiple models. Retrying delivery of the same launch request reuses that request's run; an intentional additional launch creates another run even when every agent/target parameter matches.

Provide a PR-filtered run list showing every recorded run, with one row per run and revision metadata available when supplied. Do not collapse independent runs into one latest run or one status for the agent/PR pair. A future Start another run action belongs to the deferred launch feature.

Tracking retains each run's own artifacts and output links. Workspace isolation, concurrent-write handling, queue capacity, and target-freshness enforcement belong to the later execution integration.

## Recommended navigation and views

Use one **Agents & bots** navigation area with an agent/bot catalog and a Runs view. Individual agent and run details have linkable URLs without adding every agent or run to the main navigation. Select the repositories in scope and filter by PR within that scope. Access will use specific logged-in users and repository scope; detailed access configuration is deferred, not a first-phase management UI.

### Catalog table

Suggested fields:

- Agent/bot name and purpose.
- Category: Prebid agent or other bot.
- GitHub account.
- Configured harness and model, when known.
- Tracking coverage and data freshness: recorded runs, GitHub activity only, or unknown.
- Repositories associated with the agent's tracked activity, shown compactly with a detail list.
- Active recorded runs and latest recorded run, where known.
- Last observed GitHub activity, clearly distinct from runtime heartbeat/health.

Clicking an agent opens a focused tracking view with its read-only definition summary, repository breakdown, recorded runs, and linked GitHub activity. Do not infer a specific agent definition from a shared account's posts when attribution is missing.

### Runs table

One row per recorded logical run. Suggested fields are run ID, agent, recorded harness/model, repository/PR, known requester or trigger, execution status, result summary, publication status, start time, duration, and last update. Exact IDs, revisions, versions, settings, and multi-model details can appear in secondary run metadata when available; they do not require new control flows.

Filter by agent, harness, model, repository, PR, status, requester, and date range. Default to recent runs with a clear active-run filter. Use the existing 50-row Previous/Next pagination pattern and query the full matching result set before pagination. Distinguish configured-model filtering from reported-model filtering when they differ.

### Run detail

Show the information needed to understand and investigate the execution:

- Requested agent and its captured configuration/version reference, where available.
- Configured versus reported model, provider, model identifier/version, harness/version, and supported runtime settings, with the source and availability clear.
- Repository/PR context, with any supplied revision metadata in secondary details. Handling changes to a PR during execution is deferred and is not a required frontend workflow.
- Who requested the run, when it was accepted/started/finished, runner location or integration, and native run/session link if available.
- Execution stages and attempts, last update/heartbeat, and any known error or request for input.
- Result summary, generated artifacts, and separately confirmed GitHub output links/IDs.
- Redacted execution logs or a link to the native run viewer, subject to access and availability.
- Duration, token usage, and cost only when supported by the source. Distinguish reported from estimated values; use a dash for unavailable values, including subscription-based runs without a reliable per-run cost.

Do not promise a full trace or hidden model reasoning that the runner does not expose. Agent execution information belongs here; PR descriptions, comment threads, and diffs continue to open on GitHub rather than being recreated as repository-record views.

## Historical GitHub activity versus recorded runs

The agent/bot GitHub account is a useful starting point for discovering prior PRs, comments, submitted reviews, approvals, and commits. Those are observable outputs, not automatically distinct runtime sessions.

One run may produce several GitHub actions, and a run may produce none. A shared account also does not identify whether Codex, Claude Code, another agent definition, or another execution environment produced an action.

- Import historical GitHub activity with its source links, actor, target, and timestamps.
- Label activity without reliable runtime correlation **GitHub activity only**; run status, duration, cost, and configuration remain unknown.
- Associate it with a run only when an explicit run/session identifier or another reliable recorded relationship supports the association. A nearby timestamp alone is not sufficient.
- Do not count each comment/review as a run or duplicate shared-account activity into every agent definition's run history.
- Going forward, a launch integration should record the run ID, target, actual execution context where available, lifecycle events, and output links. A manually started local run can be recorded if its integration supplies equivalent metadata; the GitHub account alone does not provide it.

Historical activity remains useful even when detailed run history is unavailable. Display coverage and source explicitly.




## Execution, results, and publication are separate

Suggested execution states are Submitting, Queued, Running, Needs input (if supported), Cancel requested, Completed, Failed, Cancelled, Timed out, and Status unknown. Preserve the runner's native status and freshness alongside the normalized display.

Separately show:

- **Task result:** for example, findings produced, no findings, patch produced, or no usable result.
- **GitHub publication:** not requested, pending, published, partially published, failed, uncertain, or blocked by changed target, as applicable to the existing agent workflow.

A completed process does not prove the result was posted to GitHub. Display confirmed publication references when available, alongside each run's result, rather than relying only on an agent message claiming success. Separate runs retain their own output links. Publishing and retry policies belong to the later execution integration.

Cancellation is a request until the runner confirms termination. It does not undo comments or commits already published. A stale heartbeat or disconnected browser does not itself establish failure or cancellation. Disabling future launches is distinct from stopping runs already executing.

The tracking UI can display observed cancellation, retry, or timeout states without offering execution controls. Starting, cancelling, and retrying runs are deferred. Pause/resume, batch launching, schedules, and coordinated multi-agent workflows are not current frontend scope.

## Tracking continuity

Run history and filters should survive navigation away from the page. Show available logs/artifacts, their source links, and unavailable or expired states accurately. Choose actual retention and runner-control limits during integration; those choices do not block the tracking frontend.

## Relationship to contribution reports

Run counts and contribution credits have different units. Preserve every genuine run and execution attempt for operations, even when several runs target the same PR. The Contributions report still grants at most one lifetime credit per account/PR/metric.

Model and harness are not additional contribution-credit keys. Running the same account through a different model or harness on the same PR does not create another feedback or approval contribution of the same type.

An internal report-only run creates no GitHub approval or feedback credit merely by finishing. A retry that publishes repeated feedback does not create another contribution credit. The human who started a run is not automatically credited as the author of actions posted by the configured agent account.

## Tracking integration and fixture-first delivery

The first frontend reads catalog data, GitHub activity, recorded run history, statuses, and output links through a tracking data boundary. It does not depend on an execution service. Preserve sources and data availability so a GitHub-only record is not presented as a fully observed runtime session.

Build the catalog, run history, focused tracking views, repository/agent/model/harness filters, and pagination using clearly marked fixtures. Include unavailable values and GitHub-only historical activity. No simulated deployment or execution-control flow is required in this phase.

Connect actual tracking sources later. Account mapping and captured run metadata serve different purposes; local sessions can contribute recorded runs when an integration exposes their metadata. Exact connections and login-based user/repository restrictions can be supplied at that stage.

Only after tracking is established should a registered launcher be connected for existing agents. The earlier proposals are in [deferred launching notes](agent-launching-deferred.md); they are not dependencies or open blockers for the first frontend design.


## Representative tracking fixtures

- A Prebid agent with recorded run data and a bot with only observable GitHub activity.
- Several agent definitions sharing one GitHub account, with historical actions that cannot be assigned to a run.
- Completed runs with findings or no findings, failed runs, and execution completed with publication failed.
- A run that posted nothing, distinguished from the absence of a recorded run.
- Missing or stale tracking data without inventing a failed/offline state.
- Several runs on the same PR, including multiple runs of the same agent/model and runs with different models.
- Run costs, logs, or model details unavailable, versus known zero or explicitly empty output.
- Repository, PR, agent, harness, model, status, and date filters across more than 100 recorded runs.
- Repeated runs remain in history while contribution credits remain deduplicated.
- Agent defaults change while historical runs retain their captured model/harness metadata.
- A multi-model run retains the observed model attribution available from its source.

No launch, cancellation, PR-eligibility, or revision-change policy workflow is required in the tracking prototype.

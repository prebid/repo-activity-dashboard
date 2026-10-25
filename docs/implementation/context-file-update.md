## Files

Updated root CLAUDE.md as the existing Claude-class context file. The file is 11 lines and 1404 bytes, below its 200-line budget. No nested context files were added.

## Routing report

- Preview/production command distinction: kept because selecting the wrong build changes authentication behavior; grounded in scripts/app.mjs, package.json, and amplify.yml.
- Built-app browser verification and port 3100: kept because a stale build or occupied port invalidates the check; grounded in playwright.config.ts and package.json.
- Typed display boundary and single catalog: kept as a project decision; enforcement lives in scripts/check-boundaries.mjs and ESLint.
- TanStack v9 API warning: kept because older examples are incompatible with the installed major.
- Full architecture/product details: routed to existing product and implementation references.
- Old repository lists, ingestion commands, generated-file schemas, and obsolete production checklist: removed from always-on context because those implementations were retired.
- Generic framework explanations and feature inventories: removed because they are derivable or belong in the README.

## Validation

Reviewed checklist rows 11, 12, 13, 14, and 25: bounded size, important mode distinction near the start, no timestamps or transient run values, and only the sanctioned root filename. Commands correspond to package scripts and configuration. Repository npm checks are the applicable executable verification; this project has no z-harness tools/verify.py. Static context checks do not establish agent behavior. Actual implementation check outcomes are recorded in quality-foundation-status.md.

# Dependency audit disposition

`npm run audit:dependencies` audits the full dependency graph, including development tools. Unknown advisories, malformed or incomplete reports, audit-command failures, missing evidence and changed exception inputs fail the gate.

## GHSA-g3hv-75wg-m249 — minimatch 3.1.5 only

Reviewed and approved on October 30, 2026. The [upstream advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) reports pattern amplification in `firstPhasePreProcess()` at optimization level 2. Its published version range includes legacy minimatch 3, but the installed 3.1.5 implementation does not contain that optimization phase.

A bounded pattern with six `**/../segment` groups produced one pattern in 3.1.5, 64 in the affected 10.2.6 implementation, and eight in patched 11.0.3 with `braceExpandMax: 8`. The regression test retains the legacy non-amplification and patched-budget checks. Legacy ESLint plugins call minimatch's CommonJS function export; forcing the modern object export into those consumers would break them.

The exception therefore applies only to this advisory, its reviewed moderate severity/range, development-only minimatch 3.1.5 installations with the exact reviewed lockfile integrity and installed source hash. Every installed copy named in the report must qualify. Other advisories on minimatch, different versions, runtime dependencies, changed source and unexplained dependency graphs remain blocking. The audit output explicitly reports accepted findings rather than claiming zero vulnerabilities.

`scripts/audit-dependencies.mjs` owns this policy; `tests/unit/dependency-audit.test.ts` covers the disposition, real installed packages, inherited/cyclic npm metadata and failure cases. Remove the exception when upstream narrows the advisory or the legacy consumers adopt a supported patched API. No broad severity waiver, omitted development scan or disabled lint rule is used.

## Patched modern consumers

- Storybook's `@joshwooding/vite-plugin-react-docgen-typescript` receives `glob` 14.0.3 through a scoped override, addressing [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). A direct test resolves `glob` from that consumer and checks its `globSync` API with the actual absolute/cwd/ignore/nodir options and known file membership. The normal Storybook build also passes, but its default `react-docgen` mode does not exercise this TypeScript docgen path.
- `@typescript-eslint/typescript-estree` receives minimatch 11.0.3 through a scoped override. Its named `minimatch()` API is retained; lint and parser checks exercise the consumer.

These overrides leave the older function-export consumers on their compatible API. Review/remove each override when its parent dependency accepts the patched version directly.

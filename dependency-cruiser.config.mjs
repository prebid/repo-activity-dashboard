import { builtinModules } from 'node:module';
import { readdirSync, existsSync } from 'node:fs';
import { applicationSources } from './scripts/application-sources.mjs';
const clientPaths = applicationSources(process.cwd())
  .filter((file) => file.client)
  .map((file) => '^' + file.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
const presentationRoots = ['^src/(components|features)/', ...clientPaths].join('|');
const builtins = [...new Set(builtinModules.map((name) => name.replace(/^node:/, '')))];
const corePath =
  '^(?:node:)?(?:' +
  builtins.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
  ')$';
const features = existsSync('src/features')
  ? readdirSync('src/features', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];
/** @type {import('dependency-cruiser').IConfiguration} */
const configuration = {
  forbidden: [
    {
      name: 'models-no-presentation',
      severity: 'error',
      from: { path: '^src/models/' },
      to: { path: '^src/lib/(presentation|navigation)/', reachable: true },
    },
    {
      name: 'current-viewer-boundary',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/lib/auth/(?:http-auth|session-transport)\\.ts$' },
      to: { path: '^src/lib/auth/auth\\.ts$' },
    },
    {
      name: 'table-no-router',
      severity: 'error',
      from: { path: '^src/components/tables/' },
      to: { path: '^node_modules/next/(?:navigation|router)', reachable: true },
    },
    {
      name: 'application-no-operator-scripts',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^scripts/', reachable: true },
    },
    { name: 'no-cycles', severity: 'error', from: { path: '^src/' }, to: { circular: true } },
    {
      name: 'no-unresolved',
      severity: 'error',
      from: { path: '^src/' },
      to: { couldNotResolve: true },
    },
    {
      name: 'presentation-no-server-or-samples',
      severity: 'error',
      from: { path: presentationRoots },
      to: {
        path: '^src/(app|mocks|server|lib/(auth|aws))/|^node_modules/(@aws-sdk/|server-only/)',
        // global-error.tsx replaces the root layout, so it imports the shared stylesheet itself.
        pathNot: '^src/app/globals\\.css$',
        reachable: true,
      },
    },
    {
      name: 'global-stylesheet-in-root-documents-only',
      severity: 'error',
      from: { path: presentationRoots, pathNot: '^src/app/global-error\\.tsx$' },
      to: { path: '^src/app/globals\\.css$' },
    },
    {
      name: 'presentation-no-node',
      severity: 'error',
      from: { path: presentationRoots },
      to: { path: corePath, reachable: true },
    },
    {
      name: 'shared-no-features',
      severity: 'error',
      from: { path: '^src/components/' },
      to: { path: '^src/features/', reachable: true },
    },
    {
      name: 'pure-layer-direction',
      severity: 'error',
      from: { path: '^src/(models/|config/|lib/(presentation/|utils\\.ts))' },
      to: { path: '^src/(app|features|components|mocks|server|lib/(auth|aws))/', reachable: true },
    },
    ...features.map((feature) => ({
      name: 'feature-isolation-' + feature,
      severity: /** @type {const} */ ('error'),
      from: { path: '^src/features/' + feature + '/' },
      to: { path: '^src/features/', pathNot: '^src/features/' + feature + '/', reachable: true },
    })),
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
export default configuration;

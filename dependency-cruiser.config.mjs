import { builtinModules } from 'node:module';
import { readdirSync, existsSync } from 'node:fs';
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
      from: { path: '^src/(components|features)/' },
      to: {
        path: '^src/(app|mocks|server|lib/(auth|aws))/|^node_modules/(@aws-sdk/|server-only/)',
        reachable: true,
      },
    },
    {
      name: 'presentation-no-node',
      severity: 'error',
      from: { path: '^src/(components|features)/' },
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

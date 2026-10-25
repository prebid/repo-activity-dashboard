import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { isBuiltin } from 'node:module';
import { applicationSources } from './application-sources.mjs';
const retired = [
  'src/services',
  'src/scripts',
  'src/validation',
  'src/lib/repoData.ts',
  'src/index.ts',
  'src/generateStats.ts',
  'store',
  'public/store',
  'contributor-repo-timeline.json',
  'contributor-stats.json',
  'repo-stats.json',
  'repos.json',
];
/** @param {string} root */
export function inspectBoundaries(root) {
  const failures = [];
  let count = 0;
  for (const name of retired)
    if (existsSync(resolve(root, name))) {
      // Empty directories can remain after git deletes files; only content matters.
      const p = resolve(root, name);
      if (!name.includes('.') && readdirSync(p).length === 0) continue;
      failures.push('Retired reporting path remains: ' + name);
    }
  const files = applicationSources(root);
  for (const { name, source, client } of files) {
    count++;
    const path = resolve(root, name);
    const presentation = client || /^src\/(components|features)\//.test(name);
    /** @param {string} specifier */
    const validate = (specifier) => {
      const target = specifier.startsWith('@/')
        ? 'src/' + specifier.slice(2)
        : specifier.startsWith('.')
          ? relative(root, resolve(dirname(path), specifier))
              .split(sep)
              .join('/')
          : specifier;
      if (
        /(^|\/)(store|services|validation)\//.test(target) ||
        target.includes('contributor-repo-timeline') ||
        target.includes('lib/repoData')
      )
        failures.push(name + ': retired import ' + specifier);
      if (
        presentation &&
        (/^(src\/(mocks|server|lib\/(auth|aws))\/|node:|@aws-sdk\/)/.test(target) ||
          isBuiltin(specifier))
      )
        failures.push(name + ': presentation imports ' + specifier);
    };
    /** @param {ts.Node} node */
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        validate(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      ) {
        if (
          node.arguments[0] &&
          (ts.isStringLiteral(node.arguments[0]) ||
            ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
        )
          validate(node.arguments[0].text);
        else failures.push(name + ': computed module import requires explicit review');
      }
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        (node.text === '/store' || node.text.startsWith('/store/'))
      )
        failures.push(name + ': raw store request');
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  if (count === 0) failures.push('No source files selected');
  /** @type {unknown} */
  const decoded = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded))
    throw new Error('Invalid package manifest');
  const pkg = /** @type {Record<string, unknown>} */ (decoded);
  const dependencies =
    pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies : {};
  const devDependencies =
    pkg.devDependencies && typeof pkg.devDependencies === 'object' ? pkg.devDependencies : {};
  const scripts =
    pkg.scripts && typeof pkg.scripts === 'object'
      ? /** @type {Record<string,unknown>} */ (pkg.scripts)
      : {};
  for (const dependency of [
    '@octokit/rest',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    'csv-parse',
  ])
    if (Object.hasOwn(dependencies, dependency) || Object.hasOwn(devDependencies, dependency))
      failures.push('Retired dependency: ' + dependency);
  for (const [name, command] of Object.entries(scripts))
    if (
      typeof command === 'string' &&
      /sync:mapping|syncMappingFromS3|generateContributor|src\/index\.ts/.test(command)
    )
      failures.push('Retired script: ' + name);
  return { sourceFiles: count, failures };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = inspectBoundaries(process.cwd());
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length) process.exitCode = 1;
}

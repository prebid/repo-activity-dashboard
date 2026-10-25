import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
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
  /** @param {string} directory */
  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        scan(path);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(path)) continue;
      count++;
      const name = relative(root, path).split(sep).join('/');
      const source = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const presentation = /^src\/(components|features)\//.test(name);
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
          /^(src\/(mocks|server|lib\/(auth|aws))\/|node:|@aws-sdk\/)/.test(target)
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
          if (node.arguments[0] && ts.isStringLiteral(node.arguments[0]))
            validate(node.arguments[0].text);
          else failures.push(name + ': computed module import requires explicit review');
        }
        if (ts.isStringLiteral(node) && node.text.startsWith('/store/'))
          failures.push(name + ': raw store request');
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  scan(resolve(root, 'src'));
  if (count === 0) failures.push('No source files selected');
  /** @type {{dependencies?: Record<string,string>, scripts?: Record<string,string>}} */
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  for (const dependency of [
    '@octokit/rest',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    'csv-parse',
  ])
    if (pkg.dependencies?.[dependency]) failures.push('Retired dependency: ' + dependency);
  for (const [name, command] of Object.entries(pkg.scripts ?? {}))
    if (/sync:mapping|syncMappingFromS3|generateContributor|src\/index\.ts/.test(command))
      failures.push('Retired script: ' + name);
  return { sourceFiles: count, failures };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = inspectBoundaries(process.cwd());
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length) process.exitCode = 1;
}

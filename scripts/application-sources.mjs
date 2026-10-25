import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import ts from 'typescript';

/** @param {string} root */
export function applicationSources(root) {
  /** @type {{ name: string, source: ts.SourceFile, client: boolean }[]} */
  const files = [];
  /** @param {string} directory */
  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        scan(path);
        continue;
      }
      if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
      const source = ts.createSourceFile(
        path,
        readFileSync(path, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      let client = false;
      // React directives are a prologue, before imports or other statements.
      for (const statement of source.statements) {
        if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression))
          break;
        if (statement.expression.text === 'use client') client = true;
      }
      files.push({ name: relative(root, path).split(sep).join('/'), source, client });
    }
  }
  scan(resolve(root, 'src'));
  return files;
}

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parseImports, collectIdentifiers } from './parser.js';
import { buildRenameMap } from './renamer.js';
import { resolveModulePath } from './resolver.js';
import { findAliasConflicts } from './aliasCheck.js';

export interface LintOptions {
  input: string;
}

interface LintResult {
  ok: boolean;
  errors: string[];
}

export async function lint(options: LintOptions): Promise<LintResult> {
  const inputPath = resolve(options.input);
  const inputDir = dirname(inputPath);
  const errors: string[] = [];

  let mainContent: string;
  try {
    mainContent = await readFile(inputPath, 'utf-8');
  } catch {
    return { ok: false, errors: [`File not found: ${options.input}`] };
  }

  console.log(`Linting: ${options.input}\n`);

  const imports = parseImports(mainContent);
  if (imports.length === 0) {
    console.log('  No imports found.');
    return { ok: true, errors: [] };
  }

  const aliases = imports.map(i => i.alias);
  const dupes = aliases.filter((a, i) => aliases.indexOf(a) !== i);
  for (const dupe of [...new Set(dupes)]) {
    errors.push(`Duplicate alias: "${dupe}"`);
  }

  const aliasConflicts = await findAliasConflicts(mainContent, inputDir);
  if (aliasConflicts.length > 0) {
    console.log('Alias conflicts (build will fail):\n');
    for (const conflict of aliasConflicts) {
      console.log(`  ✗ ${conflict.modulePath}`);
      for (const u of conflict.usages) {
        console.log(`      "${u.alias}"  ←  ${u.importedBy}`);
      }
      errors.push(
        `Alias conflict in "${conflict.modulePath}": ` +
          conflict.usages.map(u => `"${u.alias}" (${u.importedBy})`).join(' vs '),
      );
    }
    console.log();
  }

  console.log(`Found ${imports.length} import(s)\n`);

  for (const imp of imports) {
    console.log(`  import ${imp.filePath} as ${imp.alias}`);

    let modulePath: string;
    try {
      modulePath = await resolveModulePath(inputDir, imp.filePath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      console.log(`  ✗ ${msg}\n`);
      continue;
    }

    const moduleContent = await readFile(modulePath, 'utf-8');
    const moduleLines = moduleContent.split('\n');
    const ids = collectIdentifiers(moduleLines);
    const renameMap = buildRenameMap(ids, imp.alias);

    const nestedImports = parseImports(moduleContent);
    if (nestedImports.length > 0) {
      console.log(`\n  Nested imports (${nestedImports.length}):`);
      for (const ni of nestedImports) {
        console.log(`    ${ni.alias} ← ${ni.filePath}`);
      }
    }

    printSection('Types', ids.types, imp.alias);
    printSection('Functions', ids.functions, imp.alias);
    printSection('Variables', ids.vars, imp.alias);

    const aliasRefs = findAliasRefs(mainContent, imp.alias);
    if (aliasRefs.length > 0) {
      console.log(`\n  Transforms in main file:`);
      for (const ref of aliasRefs) {
        console.log(`    ${ref.original.padEnd(30)} →  ${ref.renamed}`);
      }
    }

    const unusedAliases = findUnusedAliasRefs(mainContent, imp.alias, renameMap);
    for (const name of unusedAliases) {
      console.log(`  ⚠ ${imp.alias}::${name} referenced in main but not defined in module`);
    }

    console.log();
  }

  if (errors.length > 0) {
    console.log('Errors:');
    for (const e of errors) console.log(`  ✗ ${e}`);
    console.log();
  } else {
    console.log('✓ Build check passed');
  }

  return { ok: errors.length === 0, errors };
}

function printSection(label: string, names: string[], alias: string): void {
  if (names.length === 0) return;
  console.log(`\n  ${label} (${names.length}):`);
  for (const name of names) {
    console.log(`    ${name.padEnd(24)} →  ${alias}_${name}`);
  }
}

interface AliasRef {
  original: string;
  renamed: string;
}

function findAliasRefs(content: string, alias: string): AliasRef[] {
  const re = new RegExp(`\\b${alias}::([a-zA-Z_]\\w*)`, 'g');
  const seen = new Set<string>();
  const refs: AliasRef[] = [];
  for (const m of content.matchAll(re)) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      refs.push({ original: m[0], renamed: `${alias}_${m[1]}` });
    }
  }
  return refs;
}

function findUnusedAliasRefs(
  content: string,
  alias: string,
  renameMap: Map<string, string>,
): string[] {
  const re = new RegExp(`\\b${alias}::([a-zA-Z_]\\w*)`, 'g');
  const unused: string[] = [];
  for (const m of content.matchAll(re)) {
    if (!renameMap.has(m[1])) unused.push(m[1]);
  }
  return [...new Set(unused)];
}

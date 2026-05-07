import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parseImports, collectIdentifiers, filterHeaderLines } from './parser.js';
import { buildRenameMap, applyRenameMap } from './renamer.js';
import { createInlineBlock } from './inliner.js';
import { resolveModulePath } from './resolver.js';

export interface BuildOptions {
  input: string;
  output: string;
}

export async function build(options: BuildOptions): Promise<void> {
  const inputPath = resolve(options.input);
  const inputDir = dirname(inputPath);
  const mainContent = await readFile(inputPath, 'utf-8');
  const mainLines = mainContent.split('\n');

  const imports = parseImports(mainContent);

  // Validate: no duplicate aliases
  const aliases = imports.map(i => i.alias);
  const dupes = aliases.filter((a, i) => aliases.indexOf(a) !== i);
  if (dupes.length > 0) throw new Error(`Duplicate import aliases: ${dupes.join(', ')}`);

  const inlineBlocks: string[][] = [];
  for (const imp of imports) {
    const modulePath = await resolveModulePath(inputDir, imp.filePath);
    const moduleContent = await readFile(modulePath, 'utf-8');
    const moduleLines = moduleContent.split('\n');

    const ids = collectIdentifiers(moduleLines);
    const renameMap = buildRenameMap(ids, imp.alias);
    const contentLines = filterHeaderLines(moduleLines);
    const renamedLines = applyRenameMap(contentLines, renameMap);

    inlineBlocks.push(createInlineBlock(renamedLines, imp.filePath));
  }

  // Assemble output — insert inline blocks after indicator/strategy/library line
  const hasIndicatorLine = mainLines.some(l =>
    l.trim().match(/^(indicator|strategy|library)\s*\(/)
  );

  const outputLines: string[] = [];
  let insertionDone = false;

  for (const line of mainLines) {
    const trimmed = line.trim();

    if (trimmed.match(/^\/\/\s*@import\s+/)) continue;

    outputLines.push(line);

    if (!insertionDone) {
      const isInsertPoint = hasIndicatorLine
        ? trimmed.match(/^(indicator|strategy|library)\s*\(/) !== null
        : trimmed.startsWith('//@version=');

      if (isInsertPoint) {
        outputLines.push('');
        for (const block of inlineBlocks) outputLines.push(...block);
        insertionDone = true;
      }
    }
  }

  // Transform alias.X → alias_X in the main file lines
  const finalLines = outputLines.map(line => transformAliasRefs(line, imports.map(i => i.alias)));

  await writeFile(options.output, finalLines.join('\n'), 'utf-8');
  console.log(`Built: ${options.output}`);
}

function transformAliasRefs(line: string, aliases: string[]): string {
  let result = line;
  for (const alias of aliases) {
    // alias.X → alias_X  (X is any identifier)
    result = result.replace(
      new RegExp(`\\b${alias}\\.([a-zA-Z_]\\w*)`, 'g'),
      `${alias}_$1`
    );
  }
  return result;
}

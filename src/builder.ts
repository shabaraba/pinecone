import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parseImports, collectIdentifiers, filterHeaderLines } from './parser.js';
import { buildRenameMap, applyRenameMap, applyModuleRefs } from './renamer.js';
import { createInlineBlock } from './inliner.js';
import { resolveModuleGraph } from './graph.js';

export interface BuildOptions {
  input: string;
  output: string;
}

export async function build(options: BuildOptions): Promise<void> {
  const inputPath = resolve(options.input);
  const inputDir = dirname(inputPath);
  const mainContent = await readFile(inputPath, 'utf-8');
  const mainLines = mainContent.split('\n');

  const directImports = parseImports(mainContent);
  const dupes = directImports.map(i => i.alias).filter((a, i, arr) => arr.indexOf(a) !== i);
  if (dupes.length > 0) throw new Error(`Duplicate import aliases: ${dupes.join(', ')}`);

  const orderedModules = await resolveModuleGraph(mainContent, inputDir);

  const inlineBlocks: string[][] = [];
  for (const mod of orderedModules) {
    const moduleLines = mod.content.split('\n');
    const contentLines = filterHeaderLines(moduleLines);

    // Step 1: resolve this module's own import refs (alias::X → alias_X) before own-rename
    const modAliases = mod.ownImports.map(i => i.alias);
    const dealiasedLines = applyModuleRefs(contentLines, modAliases);

    // Step 2: rename this module's own identifiers
    const ids = collectIdentifiers(moduleLines);
    const renameMap = buildRenameMap(ids, mod.alias);
    const renamedLines = applyRenameMap(dealiasedLines, renameMap);

    inlineBlocks.push(createInlineBlock(renamedLines, mod.absolutePath));
  }

  const allAliases = orderedModules.map(m => m.alias);
  const hasIndicatorLine = mainLines.some(l => /^(indicator|strategy|library)\s*\(/.test(l.trim()));

  const outputLines: string[] = [];
  let insertionDone = false;

  for (const line of mainLines) {
    const trimmed = line.trim();
    if (/^\/\/\s*@import\s+/.test(trimmed)) continue;

    outputLines.push(line);

    if (!insertionDone) {
      const isInsertPoint = hasIndicatorLine
        ? /^(indicator|strategy|library)\s*\(/.test(trimmed)
        : trimmed.startsWith('//@version=');

      if (isInsertPoint) {
        outputLines.push('');
        for (const block of inlineBlocks) outputLines.push(...block);
        insertionDone = true;
      }
    }
  }

  const finalLines = applyModuleRefs(outputLines, allAliases);
  await writeFile(options.output, finalLines.join('\n'), 'utf-8');
  console.log(`Built: ${options.output}`);
}

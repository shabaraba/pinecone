import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parseImports, collectIdentifiers, filterHeaderLines } from './parser.js';
import { buildRenameMap, applyRenameMap, applyModuleRefs } from './renamer.js';
import { createInlineBlock } from './inliner.js';
import { resolveModuleGraph } from './graph.js';

export interface ExpandResult {
  mainLines: string[];
  inlineBlocks: string[][];
  allAliases: string[];
  hasIndicatorLine: boolean;
}

export async function resolveAndExpand(inputPath: string): Promise<ExpandResult> {
  const absPath = resolve(inputPath);
  const inputDir = dirname(absPath);
  const mainContent = await readFile(absPath, 'utf-8');
  const mainLines = mainContent.split('\n');

  const directImports = parseImports(mainContent);
  const dupes = directImports.map(i => i.alias).filter((a, i, arr) => arr.indexOf(a) !== i);
  if (dupes.length > 0) throw new Error(`Duplicate import aliases: ${dupes.join(', ')}`);

  const orderedModules = await resolveModuleGraph(mainContent, inputDir);

  const inlineBlocks: string[][] = [];
  for (const mod of orderedModules) {
    const moduleLines = mod.content.split('\n');
    const contentLines = filterHeaderLines(moduleLines);
    const modAliases = mod.ownImports.map(i => i.alias);
    const dealiasedLines = applyModuleRefs(contentLines, modAliases);
    const ids = collectIdentifiers(moduleLines);
    const renameMap = buildRenameMap(ids, mod.alias);
    const renamedLines = applyRenameMap(dealiasedLines, renameMap);
    inlineBlocks.push(createInlineBlock(renamedLines, mod.absolutePath));
  }

  const allAliases = orderedModules.map(m => m.alias);
  const hasIndicatorLine = mainLines.some(l => /^(indicator|strategy|library)\s*\(/.test(l.trim()));

  return { mainLines, inlineBlocks, allAliases, hasIndicatorLine };
}

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyModuleRefs } from './renamer.js';
import { resolveAndExpand } from './expander.js';
import { generateMql5 } from './mql5/generator.js';
import { formatWarnings } from './mql5/warnings.js';

export interface TranspileOptions {
  input: string;
  output: string;
}

export async function transpile(options: TranspileOptions): Promise<void> {
  const { mainLines, inlineBlocks, allAliases } = await resolveAndExpand(resolve(options.input));

  // Assemble fully expanded PineScript lines (same as build, but without file output)
  const expandedLines: string[] = [];
  let insertionDone = false;
  const hasIndicatorLine = mainLines.some(l => /^(indicator|strategy|library)\s*\(/.test(l.trim()));

  for (const line of mainLines) {
    const trimmed = line.trim();
    if (/^\/\/\s*@import\s+/.test(trimmed)) continue;

    expandedLines.push(line);

    if (!insertionDone) {
      const isInsertPoint = hasIndicatorLine
        ? /^(indicator|strategy|library)\s*\(/.test(trimmed)
        : trimmed.startsWith('//@version=');

      if (isInsertPoint) {
        expandedLines.push('');
        for (const block of inlineBlocks) expandedLines.push(...block);
        insertionDone = true;
      }
    }
  }

  const finalLines = applyModuleRefs(expandedLines, allAliases);
  const { code, warnings } = generateMql5(finalLines);

  await writeFile(options.output, code, 'utf-8');
  console.log(`transpile: ${options.output}`);
  if (warnings.length > 0) {
    console.log(formatWarnings(warnings));
  }
}

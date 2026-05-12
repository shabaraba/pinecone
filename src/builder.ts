import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { applyModuleRefs } from './renamer.js';
import { resolveAndExpand } from './expander.js';

export interface BuildOptions {
  input: string;
  output: string;
}

export async function build(options: BuildOptions): Promise<void> {
  const { mainLines, inlineBlocks, allAliases, hasIndicatorLine } = await resolveAndExpand(resolve(options.input));

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

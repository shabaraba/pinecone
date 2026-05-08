import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseImports } from './parser.js';
import { resolveModulePath } from './resolver.js';
import type { ResolvedModuleNode } from './types.js';

export async function resolveModuleGraph(
  mainContent: string,
  mainDir: string,
): Promise<ResolvedModuleNode[]> {
  const ordered: ResolvedModuleNode[] = [];
  const aliasByPath = new Map<string, string>();
  const visiting = new Set<string>();
  const processed = new Set<string>();

  async function visit(content: string, baseDir: string): Promise<void> {
    for (const imp of parseImports(content)) {
      const absPath = await resolveModulePath(baseDir, imp.filePath);

      if (visiting.has(absPath)) {
        throw new Error(`Circular import detected: "${absPath}"`);
      }

      if (aliasByPath.has(absPath)) {
        if (aliasByPath.get(absPath) !== imp.alias) {
          throw new Error(
            `Module "${imp.filePath}" imported with conflicting aliases: ` +
              `"${imp.alias}" vs "${aliasByPath.get(absPath)}"`,
          );
        }
        continue;
      }

      aliasByPath.set(absPath, imp.alias);
      visiting.add(absPath);

      const moduleContent = await readFile(absPath, 'utf-8');
      await visit(moduleContent, dirname(absPath));

      visiting.delete(absPath);

      if (!processed.has(absPath)) {
        processed.add(absPath);
        ordered.push({
          absolutePath: absPath,
          alias: imp.alias,
          content: moduleContent,
          ownImports: parseImports(moduleContent),
        });
      }
    }
  }

  await visit(mainContent, mainDir);
  return ordered;
}

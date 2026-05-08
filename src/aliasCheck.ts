import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseImports } from './parser.js';
import { resolveModulePath } from './resolver.js';

interface AliasUsage {
  alias: string;
  importedBy: string;
}

export interface AliasConflict {
  modulePath: string;
  usages: AliasUsage[];
}

export async function findAliasConflicts(
  mainContent: string,
  mainDir: string,
): Promise<AliasConflict[]> {
  const usages = new Map<string, AliasUsage[]>();
  const visited = new Set<string>();

  async function walk(content: string, baseDir: string, label: string): Promise<void> {
    for (const imp of parseImports(content)) {
      let absPath: string;
      try {
        absPath = await resolveModulePath(baseDir, imp.filePath);
      } catch {
        continue;
      }

      const list = usages.get(absPath) ?? [];
      list.push({ alias: imp.alias, importedBy: label });
      usages.set(absPath, list);

      if (visited.has(absPath)) continue;
      visited.add(absPath);

      let moduleContent: string;
      try {
        moduleContent = await readFile(absPath, 'utf-8');
      } catch {
        continue;
      }

      await walk(moduleContent, dirname(absPath), absPath);
    }
  }

  await walk(mainContent, mainDir, '(main)');

  const conflicts: AliasConflict[] = [];
  for (const [modulePath, list] of usages) {
    const distinctAliases = new Set(list.map(u => u.alias));
    if (distinctAliases.size > 1) {
      conflicts.push({ modulePath, usages: list });
    }
  }
  return conflicts;
}

import { access } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const EXTENSIONS = ['.pine', '.pinescript'];

export async function resolveModulePath(baseDir: string, importPath: string): Promise<string> {
  if (extname(importPath)) {
    return resolve(baseDir, importPath);
  }

  for (const ext of EXTENSIONS) {
    const candidate = resolve(baseDir, importPath + ext);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }

  throw new Error(
    `Module not found: "${importPath}" (tried ${EXTENSIONS.map(e => importPath + e).join(', ')})`
  );
}

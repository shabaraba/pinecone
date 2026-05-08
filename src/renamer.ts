import type { ModuleIdentifiers } from './types.js';

const STRING_RE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g;

function withMaskedStrings(line: string, fn: (code: string) => string): string {
  const placeholders: string[] = [];
  const processed = line.replace(STRING_RE, match => {
    placeholders.push(match);
    return `\x00P${placeholders.length - 1}\x00`;
  });

  const commentIdx = processed.indexOf('//');
  const code = commentIdx >= 0 ? processed.slice(0, commentIdx) : processed;
  const comment = commentIdx >= 0 ? processed.slice(commentIdx) : '';

  const result = fn(code);
  return (result + comment).replace(/\x00P(\d+)\x00/g, (_, i) => placeholders[+i]);
}

export function buildRenameMap(ids: ModuleIdentifiers, alias: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of [...ids.types, ...ids.functions, ...ids.vars]) {
    if (name && !map.has(name)) map.set(name, `${alias}_${name}`);
  }
  return map;
}

export function applyRenameMap(lines: string[], renameMap: Map<string, string>): string[] {
  const entries = [...renameMap.entries()].sort((a, b) => b[0].length - a[0].length);
  return lines.map(line =>
    withMaskedStrings(line, code => {
      let result = code;
      for (const [from, to] of entries) {
        const re = new RegExp(`(?<![a-zA-Z0-9_])${escRe(from)}(?![a-zA-Z0-9_])`, 'g');
        result = result.replace(re, to);
      }
      return result;
    }),
  );
}

export function applyModuleRefs(lines: string[], aliases: string[]): string[] {
  if (aliases.length === 0) return lines;
  return lines.map(line =>
    withMaskedStrings(line, code => {
      let result = code;
      for (const alias of aliases) {
        result = result.replace(
          new RegExp(`\\b${escRe(alias)}::([a-zA-Z_]\\w*)`, 'g'),
          `${alias}_$1`,
        );
      }
      return result;
    }),
  );
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

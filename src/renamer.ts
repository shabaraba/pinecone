import type { ModuleIdentifiers } from './types.js';

// String literal pattern that handles escaped quotes
const STRING_RE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g;

export function buildRenameMap(ids: ModuleIdentifiers, alias: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of [...ids.types, ...ids.functions, ...ids.vars]) {
    if (name && !map.has(name)) map.set(name, `${alias}_${name}`);
  }
  return map;
}

export function applyRenameMap(lines: string[], renameMap: Map<string, string>): string[] {
  // Sort longest first to avoid partial replacements (e.g., "KZ" before "K")
  const entries = [...renameMap.entries()].sort((a, b) => b[0].length - a[0].length);
  return lines.map(line => applyToLine(line, entries));
}

function applyToLine(line: string, entries: [string, string][]): string {
  const placeholders: string[] = [];

  // Mask string literals
  let processed = line.replace(STRING_RE, match => {
    placeholders.push(match);
    return `\x00P${placeholders.length - 1}\x00`;
  });

  // Split at comment — don't rename inside comments
  const commentIdx = processed.indexOf('//');
  const code = commentIdx >= 0 ? processed.slice(0, commentIdx) : processed;
  const comment = commentIdx >= 0 ? processed.slice(commentIdx) : '';

  let result = code;
  for (const [from, to] of entries) {
    const re = new RegExp(`(?<![a-zA-Z0-9_])${escRe(from)}(?![a-zA-Z0-9_])`, 'g');
    result = result.replace(re, to);
  }

  // Restore masked strings
  return (result + comment).replace(/\x00P(\d+)\x00/g, (_, i) => placeholders[+i]);
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

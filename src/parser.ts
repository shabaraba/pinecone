import type { ImportDeclaration, ModuleIdentifiers } from './types.js';

const HEADER_RE = [
  /^\/\/@version=/,
  /^\/\/\s*@import\s+/,
  /^(indicator|library|strategy)\s*\(/,
];

export function parseImports(content: string): ImportDeclaration[] {
  return content.split('\n').reduce<ImportDeclaration[]>((acc, line, i) => {
    const m = line.match(/^\/\/\s*@import\s+(\S+)\s+as\s+(\w+)/);
    if (m) acc.push({ filePath: m[1], alias: m[2], lineIndex: i });
    return acc;
  }, []);
}

export function collectIdentifiers(lines: string[]): ModuleIdentifiers {
  const types: string[] = [];
  const functions: string[] = [];
  const vars: string[] = [];

  for (const line of lines) {
    if (line.match(/^[\t ]/)) continue;
    const t = line.trim();
    if (!t || t.startsWith('//') || HEADER_RE.some(r => r.test(t))) continue;

    const typeM = t.match(/^type\s+(\w+)/);
    if (typeM) { types.push(typeM[1]); continue; }

    const methodM = t.match(/^method\s+(\w+)\s*\(/);
    if (methodM) { functions.push(methodM[1]); continue; }

    if (t.includes('=>')) {
      const funcM = t.match(/^(\w+)\s*\(/);
      if (funcM) { functions.push(funcM[1]); continue; }
    }

    // var Type name = ...
    const varTypedM = t.match(/^var\s+\w[\w<>]*\s+(\w+)\s*=/);
    if (varTypedM) { vars.push(varTypedM[1]); continue; }

    // var name = ...
    const varSimpleM = t.match(/^var\s+(\w+)\s*=/);
    if (varSimpleM) { vars.push(varSimpleM[1]); continue; }

    // simple assignment (not == or =>)
    const assignM = t.match(/^(\w+)\s*=[^=>]/);
    if (assignM) { vars.push(assignM[1]); continue; }

    // TypeName varName = ...  (e.g., "bar b = bar.new()")
    const typeVarM = t.match(/^(\w+)\s+(\w+)\s*=/);
    if (typeVarM && types.includes(typeVarM[1])) vars.push(typeVarM[2]);
  }

  return {
    types: [...new Set(types)],
    functions: [...new Set(functions)],
    vars: [...new Set(vars)],
  };
}

export function filterHeaderLines(lines: string[]): string[] {
  return lines.filter(line => !HEADER_RE.some(r => r.test(line.trim())));
}

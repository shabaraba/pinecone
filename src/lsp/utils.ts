import { parseImports } from '../parser.js';
import { resolveModulePath } from '../resolver.js';
import { readFile } from 'node:fs/promises';

export function getTokenAtPosition(line: string, char: number): string {
  const wordRe = /\w/;
  // まずカーソル位置の単語（英数字+アンダースコア）を取得
  let wordStart = char;
  let wordEnd = char;
  while (wordStart > 0 && wordRe.test(line[wordStart - 1])) wordStart--;
  while (wordEnd < line.length && wordRe.test(line[wordEnd])) wordEnd++;
  const word = line.slice(wordStart, wordEnd);

  // :: パターン: .と同様にカーソル位置で挙動を変える
  // カーソルが identifier 側（前が ::）→ alias::identifier を返す
  if (wordStart >= 2 && line.slice(wordStart - 2, wordStart) === '::') {
    let prefixStart = wordStart - 2;
    while (prefixStart > 0 && wordRe.test(line[prefixStart - 1])) prefixStart--;
    return line.slice(prefixStart, wordStart - 2) + '::' + word;
  }
  // カーソルが alias 側（後ろが ::）→ alias だけを返す
  if (wordEnd + 1 < line.length && line.slice(wordEnd, wordEnd + 2) === '::') {
    return word;
  }

  // . パターン: カーソルが右側（前が .）なら left.word を返す
  // カーソルが左側（後ろが .）なら word だけを返す
  if (wordStart > 0 && line[wordStart - 1] === '.') {
    // カーソルは . の右側 → 左辺も含めて返す
    const tokenRe = /[\w.]/;
    let tokenStart = wordStart - 1;
    while (tokenStart > 0 && tokenRe.test(line[tokenStart - 1])) tokenStart--;
    let tokenEnd = wordEnd;
    while (tokenEnd < line.length && tokenRe.test(line[tokenEnd])) tokenEnd++;
    return line.slice(tokenStart, tokenEnd);
  }

  // カーソルは . の左側、または . なし → 単語だけを返す
  return word;
}

export async function buildAliasMap(
  content: string,
  fileDir: string,
): Promise<Map<string, string>> {
  const aliasMap = new Map<string, string>();
  for (const imp of parseImports(content)) {
    try {
      const absPath = await resolveModulePath(fileDir, imp.filePath);
      aliasMap.set(imp.alias, absPath);
    } catch {
      // ignore unresolved
    }
  }
  return aliasMap;
}

export async function findDefinitionLine(
  absPath: string,
  identifier: string,
): Promise<number | null> {
  const content = await readFile(absPath, 'utf-8');
  const lines = content.split('\n');
  const patterns = [
    new RegExp(`^type\\s+${identifier}\\b`),
    new RegExp(`^method\\s+${identifier}\\s*\\(`),
    new RegExp(`^${identifier}\\s*\\(`),
    new RegExp(`^var\\s+\\w[\\w<>]*\\s+${identifier}\\s*=`),
    new RegExp(`^var\\s+${identifier}\\s*=`),
    new RegExp(`^${identifier}\\s*=[^=>]`),
  ];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (patterns.some(p => p.test(trimmed))) return i;
  }
  return null;
}

export function findVariableType(content: string, varName: string): string | null {
  const lines = content.split('\n');
  // `TypeName varName = ...` or `var TypeName varName = ...`
  const pattern = new RegExp(`^(?:var\\s+)?(\\w[\\w<>]*)\\s+${varName}\\s*(?:=|:=|$)`);
  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(pattern);
    if (m && m[1] !== 'var') return m[1];
  }
  return null;
}

export function findTypeFieldLine(content: string, typeName: string, fieldName: string): number | null {
  const lines = content.split('\n');
  let inType = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (new RegExp(`^type\\s+${typeName}\\b`).test(trimmed)) {
      inType = true;
      continue;
    }
    if (inType) {
      if (/^\s/.test(lines[i])) {
        if (new RegExp(`\\b${fieldName}\\b`).test(trimmed)) return i;
      } else if (trimmed) {
        inType = false;
      }
    }
  }
  return null;
}

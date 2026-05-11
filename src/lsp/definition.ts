import { type DefinitionParams, Location, Range } from 'vscode-languageserver/node.js';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { resolveModulePath } from '../resolver.js';
import { buildAliasMap, findDefinitionLine, findTypeFieldLine, findVariableType, getTokenAtPosition } from './utils.js';

export async function onDefinition(params: DefinitionParams): Promise<Location | null> {
  const filePath = fileURLToPath(params.textDocument.uri);
  const fileDir = dirname(filePath);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lineText = content.split('\n')[params.position.line] ?? '';

  // @import 行ならそのファイルへジャンプ
  const importM = lineText.match(/^\/\/\s*@import\s+(\S+)\s+as\s+(\w+)/);
  if (importM) {
    try {
      const absPath = await resolveModulePath(fileDir, importM[1]);
      return Location.create(pathToFileURL(absPath).href, Range.create(0, 0, 0, 0));
    } catch {
      return null;
    }
  }

  const token = getTokenAtPosition(lineText, params.position.character);
  if (!token) return null;

  const aliasMap = await buildAliasMap(content, fileDir);

  // alias::Identifier パターン（モジュール関数・変数へのジャンプ）
  const colonIdx = token.indexOf('::');
  if (colonIdx !== -1) {
    const alias = token.slice(0, colonIdx);
    const identifier = token.slice(colonIdx + 2);
    const targetFile = aliasMap.get(alias);
    if (targetFile) {
      const line = identifier ? (await findDefinitionLine(targetFile, identifier)) ?? 0 : 0;
      return Location.create(pathToFileURL(targetFile).href, Range.create(line, 0, line, 0));
    }
  }

  // alias.Identifier パターン
  const dotIdx = token.indexOf('.');
  if (dotIdx !== -1) {
    const alias = token.slice(0, dotIdx);
    const identifier = token.slice(dotIdx + 1);
    const targetFile = aliasMap.get(alias);
    if (targetFile) {
      const line = identifier ? (await findDefinitionLine(targetFile, identifier)) ?? 0 : 0;
      return Location.create(pathToFileURL(targetFile).href, Range.create(line, 0, line, 0));
    }

    // 変数.フィールド パターン: 変数の型を調べてフィールド定義へジャンプ
    if (identifier) {
      const typeName = findVariableType(content, alias);
      if (typeName) {
        const fieldLine = findTypeFieldLine(content, typeName, identifier);
        if (fieldLine !== null) {
          return Location.create(params.textDocument.uri, Range.create(fieldLine, 0, fieldLine, 0));
        }
        const typeLine = await findDefinitionLine(filePath, typeName);
        if (typeLine !== null) {
          return Location.create(params.textDocument.uri, Range.create(typeLine, 0, typeLine, 0));
        }
      }
    }
  }

  // alias 単体（ob:: の ob 側にカーソル）→ インポートファイルへジャンプ
  const targetFile = aliasMap.get(token);
  if (targetFile) {
    return Location.create(pathToFileURL(targetFile).href, Range.create(0, 0, 0, 0));
  }

  // カレントファイル内の定義を探す
  const lineNum = await findDefinitionLine(filePath, token);
  if (lineNum !== null) {
    return Location.create(params.textDocument.uri, Range.create(lineNum, 0, lineNum, 0));
  }

  return null;
}

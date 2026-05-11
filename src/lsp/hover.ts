import { type HoverParams, MarkupKind, type Hover } from 'vscode-languageserver/node.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { collectIdentifiers } from '../parser.js';
import { resolveModulePath } from '../resolver.js';

export async function onHover(params: HoverParams): Promise<Hover | null> {
  const filePath = fileURLToPath(params.textDocument.uri);
  const fileDir = dirname(filePath);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lineText = content.split('\n')[params.position.line] ?? '';
  const importM = lineText.match(/^\/\/\s*@import\s+(\S+)\s+as\s+(\w+)/);
  if (!importM) return null;

  try {
    const absPath = await resolveModulePath(fileDir, importM[1]);
    const modContent = await readFile(absPath, 'utf-8');
    const ids = collectIdentifiers(modContent.split('\n'));
    const lines = [
      `**pinecone module:** \`${importM[2]}\``,
      `**file:** \`${absPath}\``,
      '',
      `- types: \`${ids.types.join('`, `') || '—'}\``,
      `- functions: \`${ids.functions.join('`, `') || '—'}\``,
      `- vars: \`${ids.vars.join('`, `') || '—'}\``,
    ];
    return { contents: { kind: MarkupKind.Markdown, value: lines.join('\n') } };
  } catch {
    return null;
  }
}

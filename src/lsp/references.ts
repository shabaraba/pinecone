import { type ReferenceParams, Location, Range } from 'vscode-languageserver/node.js';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { getTokenAtPosition } from './utils.js';

async function findPineFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(pine|pinescript)$/.test(entry.name)) {
        results.push(resolve(dir, entry.name));
      }
    }
  } catch {
    // ignore unreadable directories
  }
  return results;
}

function findOccurrences(content: string, identifier: string, filePath: string): Location[] {
  const locations: Location[] = [];
  const lines = content.split('\n');
  const re = new RegExp(`\\b${identifier}\\b`);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('//')) continue;
    const match = re.exec(line);
    if (match) {
      locations.push(Location.create(
        pathToFileURL(filePath).href,
        Range.create(i, match.index, i, match.index + identifier.length),
      ));
    }
  }
  return locations;
}

export async function onReferences(params: ReferenceParams): Promise<Location[]> {
  const filePath = fileURLToPath(params.textDocument.uri);
  const fileDir = dirname(filePath);

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  const lineText = content.split('\n')[params.position.line] ?? '';
  const token = getTokenAtPosition(lineText, params.position.character);
  if (!token || token.includes('.')) return [];

  const pineFiles = await findPineFiles(fileDir);
  if (!pineFiles.includes(filePath)) pineFiles.push(filePath);

  const locations: Location[] = [];
  for (const file of pineFiles) {
    try {
      const fileContent = await readFile(file, 'utf-8');
      locations.push(...findOccurrences(fileContent, token, file));
    } catch {
      // skip unreadable files
    }
  }
  return locations;
}

export function createInlineBlock(lines: string[], sourcePath: string): string[] {
  return [
    `// --- inlined from ${sourcePath} ---`,
    ...lines,
    `// --- end inline ---`,
    '',
  ];
}

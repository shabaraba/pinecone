export interface TranspileWarning {
  lineNo: number;
  original: string;
  reason: string;
}

export function formatWarnings(warnings: TranspileWarning[]): string {
  if (warnings.length === 0) return '';
  const lines = [`\nWarnings (${warnings.length}):`];
  for (const w of warnings) {
    lines.push(`  [line ${w.lineNo}] ${w.original}: ${w.reason}`);
  }
  return lines.join('\n');
}

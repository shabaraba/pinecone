export interface SessionParam {
  startVar: string;
  endVar: string;
  offsetVar: string;
  defaultStart: string;
  defaultEnd: string;
  defaultOffset: number;
}

let sessionCounter = 0;

export function resetSessionCounter(): void {
  sessionCounter = 0;
}

export function parseSessionInput(line: string): SessionParam | null {
  const m = line.match(/input\.session\s*\(\s*['"](\d{4})-(\d{4})['"]/);
  if (!m) return null;
  const idx = sessionCounter++;
  const suffix = idx === 0 ? '' : String(idx);
  return {
    startVar: `SessionStart${suffix}`,
    endVar: `SessionEnd${suffix}`,
    offsetVar: `UTCOffset${suffix}`,
    defaultStart: m[1],
    defaultEnd: m[2],
    defaultOffset: -5,
  };
}

export function generateSessionParams(params: SessionParam[]): string[] {
  const lines: string[] = [];
  for (const p of params) {
    lines.push(`input string ${p.startVar} = "${p.defaultStart}";`);
    lines.push(`input string ${p.endVar} = "${p.defaultEnd}";`);
    lines.push(`input int    ${p.offsetVar} = ${p.defaultOffset};`);
  }
  return lines;
}

export function generateSessionHelper(): string[] {
  return [
    'bool IsInSession(string start, string end, int utcOffset) {',
    '   datetime now = TimeGMT() + utcOffset * 3600;',
    '   MqlDateTime dt; TimeToStruct(now, dt);',
    '   int cur = dt.hour * 100 + dt.min;',
    '   int s   = (int)StringToInteger(StringSubstr(start,0,2))*100 + (int)StringToInteger(StringSubstr(start,2,2));',
    '   int e   = (int)StringToInteger(StringSubstr(end,0,2))*100   + (int)StringToInteger(StringSubstr(end,2,2));',
    '   return s <= e ? (cur >= s && cur <= e) : (cur >= s || cur <= e);',
    '}',
  ];
}

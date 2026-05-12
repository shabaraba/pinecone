let plotshapeCounter = 0;

export function resetPlotshapeCounter(): void {
  plotshapeCounter = 0;
}

const SHAPE_TO_OBJ: Record<string, { obj: string; code?: number }> = {
  'shape.arrowup':       { obj: 'OBJ_ARROW_UP' },
  'shape.arrowdown':     { obj: 'OBJ_ARROW_DOWN' },
  'shape.triangleup':    { obj: 'OBJ_ARROW_UP' },
  'shape.triangledown':  { obj: 'OBJ_ARROW_DOWN' },
  'shape.circle':        { obj: 'OBJ_ARROW', code: 159 },
  'shape.cross':         { obj: 'OBJ_ARROW', code: 251 },
  'shape.xcross':        { obj: 'OBJ_ARROW', code: 251 },
  'shape.diamond':       { obj: 'OBJ_ARROW', code: 168 },
  'shape.square':        { obj: 'OBJ_ARROW', code: 110 },
  'shape.labelup':       { obj: 'OBJ_ARROW_UP' },
  'shape.labeldown':     { obj: 'OBJ_ARROW_DOWN' },
  'shape.flag':          { obj: 'OBJ_ARROW', code: 251 },
};

interface PlotshapeArgs {
  series: string;
  style: string;
  location: string;
  color: string;
  text: string | null;
  textcolor: string | null;
}

function parseNamedArg(raw: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*([^,)]+)`);
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}

function extractArgs(argsRaw: string): PlotshapeArgs {
  // Split on top-level commas (not inside parens)
  const positional: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of argsRaw) {
    if (ch === '(' || ch === '[') { depth++; cur += ch; }
    else if (ch === ')' || ch === ']') { depth--; cur += ch; }
    else if (ch === ',' && depth === 0) { positional.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) positional.push(cur.trim());

  const series   = positional[0] ?? 'false';
  // positional[1] is title — skip
  const style    = parseNamedArg(argsRaw, 'style')    ?? positional[2] ?? 'shape.arrowup';
  const location = parseNamedArg(argsRaw, 'location') ?? positional[3] ?? 'location.abovebar';
  const color    = parseNamedArg(argsRaw, 'color')    ?? positional[4] ?? 'clrGray';
  const text     = parseNamedArg(argsRaw, 'text');
  const textcolor = parseNamedArg(argsRaw, 'textcolor');

  return { series, style: style.trim(), location: location.trim(), color: color.trim(), text, textcolor };
}

function locationToPrice(location: string): string {
  if (location === 'location.belowbar') return 'Low[0] - 5*_Point';
  if (location === 'location.abovebar') return 'High[0] + 5*_Point';
  if (location === 'location.top')      return 'ChartGetDouble(0,CHART_PRICE_MAX,0)';
  if (location === 'location.bottom')   return 'ChartGetDouble(0,CHART_PRICE_MIN,0)';
  return location; // location.absolute → series value
}

function colorToMql5(color: string): string {
  // color.new(RED, 0) → just use the base color
  const cm = color.match(/color\.new\s*\(([^,)]+)/);
  if (cm) return cm[1].trim();
  // #RRGGBB hex → leave as-is (MQL5 accepts hex color literals)
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
  // Named Pine colors (GREEN, RED, etc.) → map common ones
  const nameMap: Record<string, string> = {
    RED: 'clrRed', GREEN: 'clrGreen', BLUE: 'clrBlue', GRAY: 'clrGray',
    WHITE: 'clrWhite', BLACK: 'clrBlack', YELLOW: 'clrYellow',
    'color.red': 'clrRed', 'color.green': 'clrGreen', 'color.blue': 'clrBlue',
    'color.gray': 'clrGray', 'color.white': 'clrWhite', 'color.black': 'clrBlack',
  };
  return nameMap[color] ?? color;
}

export function convertPlotshape(argsRaw: string, indent: string): string {
  const id = plotshapeCounter++;
  const args = extractArgs(argsRaw);
  const shapeInfo = SHAPE_TO_OBJ[args.style] ?? { obj: 'OBJ_ARROW_UP' };
  const price = locationToPrice(args.location);
  const mqlColor = colorToMql5(args.color);
  const nameVar = `_ps${id}`;

  const lines: string[] = [
    `${indent}if(${args.series}) {`,
    `${indent}   string ${nameVar} = "ps_${id}_" + IntegerToString(Time[0]);`,
    `${indent}   if(ObjectFind(0,${nameVar}) < 0) {`,
    `${indent}      ObjectCreate(0,${nameVar},${shapeInfo.obj},0,Time[0],${price});`,
    `${indent}      ObjectSetInteger(0,${nameVar},OBJPROP_COLOR,${mqlColor});`,
  ];

  if (shapeInfo.code !== undefined) {
    lines.push(`${indent}      ObjectSetInteger(0,${nameVar},OBJPROP_ARROWCODE,${shapeInfo.code});`);
  }
  if (args.text) {
    lines.push(`${indent}      ObjectSetString(0,${nameVar},OBJPROP_TEXT,${args.text});`);
  }
  if (args.textcolor) {
    lines.push(`${indent}      ObjectSetInteger(0,${nameVar},OBJPROP_COLOR,${colorToMql5(args.textcolor)});`);
  }

  lines.push(`${indent}   }`, `${indent}}`);
  return lines.join('\n');
}

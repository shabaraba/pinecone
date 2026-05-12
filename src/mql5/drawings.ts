let lineCounter = 0;
let boxCounter = 0;
let labelCounter = 0;

export function resetDrawingCounters(): void {
  lineCounter = 0;
  boxCounter = 0;
  labelCounter = 0;
}

function nextLineName(): string { return `"ln_${lineCounter++}"`; }
function nextBoxName(): string  { return `"bx_${boxCounter++}"`; }
function nextLabelName(): string { return `"lb_${labelCounter++}"`; }

export function convertLineNew(args: string): string {
  const name = nextLineName();
  return `ObjectCreate(0,${name},OBJ_TREND,0,${args})`;
}

export function convertBoxNew(args: string): string {
  const name = nextBoxName();
  return `ObjectCreate(0,${name},OBJ_RECTANGLE,0,${args})`;
}

export function convertLabelNew(args: string): string {
  const name = nextLabelName();
  return `ObjectCreate(0,${name},OBJ_TEXT,0,${args})`;
}

export function convertSetXY2(objVar: string, t: string, p: string): string {
  return [
    `ObjectSetInteger(0,${objVar},OBJPROP_TIME,1,${t});`,
    `ObjectSetDouble(0,${objVar},OBJPROP_PRICE,1,${p});`,
  ].join('\n');
}

export function convertSetFirstPoint(objVar: string, t: string, p: string): string {
  return [
    `ObjectSetInteger(0,${objVar},OBJPROP_TIME,0,${t});`,
    `ObjectSetDouble(0,${objVar},OBJPROP_PRICE,0,${p});`,
  ].join('\n');
}

export function convertSetSecondPoint(objVar: string, t: string, p: string): string {
  return convertSetXY2(objVar, t, p);
}

export function convertSetColor(objVar: string, colorExpr: string): string {
  return `ObjectSetInteger(0,${objVar},OBJPROP_COLOR,${colorExpr});`;
}

export function convertSetText(objVar: string, text: string): string {
  return `ObjectSetString(0,${objVar},OBJPROP_TEXT,${text});`;
}

export function convertDelete(objVar: string): string {
  return `ObjectDelete(0,${objVar});`;
}

export function generateOnDeinitCleanup(): string[] {
  return ['   ObjectsDeleteAll(0);'];
}

export function convertChartPoint(args: string): string {
  // chart.point.new(time, na, price) → time, price
  const parts = args.split(',').map(s => s.trim());
  if (parts.length >= 3) {
    const t = parts[0];
    const p = parts[2];
    return `${t}, ${p}`;
  }
  return args;
}

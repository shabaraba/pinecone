export const SIMPLE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\btimeframe\.isintraday\b/g, '_Period < PERIOD_D1'],
  [/\btimeframe\.period\b/g, 'EnumToString(_Period)'],
  [/\btimeframe\.multiplier\b/g, '_Period'],
  [/\blast_bar_time\b/g, 'iTime(Symbol(), Period(), 0)'],
  [/\bbar_index\b/g, 'Bars(Symbol(), Period()) - 1'],
  [/\bnot\s+na\(([^)]+)\)/g, '$1 != EMPTY_VALUE'],
  [/\bna\(([^)]+)\)/g, '$1 == EMPTY_VALUE'],
  [/\bna\b/g, 'EMPTY_VALUE'],
  [/\balertcondition\s*\(/g, 'Alert('],
  [/\bmath\.max\s*\(/g, 'MathMax('],
  [/\bmath\.min\s*\(/g, 'MathMin('],
  [/\bmath\.abs\s*\(/g, 'MathAbs('],
  [/\bmath\.round\s*\(/g, 'MathRound('],
  [/\bmath\.floor\s*\(/g, 'MathFloor('],
  [/\bmath\.ceil\s*\(/g, 'MathCeil('],
  [/\bmath\.pow\s*\(/g, 'MathPow('],
  [/\bmath\.sqrt\s*\(/g, 'MathSqrt('],
  [/\bmath\.log\s*\(/g, 'MathLog('],
  [/\bmath\.exp\s*\(/g, 'MathExp('],
  [/\bmath\.sign\s*\(/g, 'MathSign('],
  [/\bstr\.tostring\s*\(/g, 'DoubleToString('],
  [/\bstr\.tonumber\s*\(/g, 'StringToDouble('],
  [/\bstr\.length\s*\(/g, 'StringLen('],
  [/\bstr\.contains\s*\(/g, 'StringFind('],
  [/\barray\.new_float\s*\(/g, 'ArrayResize('],
  [/\bcolor\.new\s*\(/g, 'ColorToARGB('],
  [/\btrue\b/g, 'true'],
  [/\bfalse\b/g, 'false'],
];

export const TA_MAPPINGS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [
    /\bta\.ema\s*\(([^,]+),\s*([^)]+)\)/g,
    m => `iMA(NULL,0,${m[2].trim()},0,MODE_EMA,PRICE_CLOSE)`,
  ],
  [
    /\bta\.sma\s*\(([^,]+),\s*([^)]+)\)/g,
    m => `iMA(NULL,0,${m[2].trim()},0,MODE_SMA,PRICE_CLOSE)`,
  ],
  [
    /\bta\.rsi\s*\(([^,]+),\s*([^)]+)\)/g,
    m => `iRSI(NULL,0,${m[2].trim()},PRICE_CLOSE)`,
  ],
  [
    /\bta\.highest\s*\(([^,]+),\s*([^)]+)\)/g,
    m => `iHighest(NULL,0,MODE_HIGH,${m[2].trim()},0)`,
  ],
  [
    /\bta\.lowest\s*\(([^,]+),\s*([^)]+)\)/g,
    m => `iLowest(NULL,0,MODE_LOW,${m[2].trim()},0)`,
  ],
  [
    /\bta\.highest\s*\(([^)]+)\)/g,
    m => `iHighest(NULL,0,MODE_HIGH,${m[1].trim()},0)`,
  ],
  [
    /\bta\.lowest\s*\(([^)]+)\)/g,
    m => `iLowest(NULL,0,MODE_LOW,${m[1].trim()},0)`,
  ],
  [
    /\bta\.crossover\s*\(([^,]+),\s*([^)]+)\)/g,
    m => `(${m[1].trim()} > ${m[2].trim()} && ${m[1].trim()}[1] <= ${m[2].trim()}[1])`,
  ],
  [
    /\bta\.crossunder\s*\(([^,]+),\s*([^)]+)\)/g,
    m => `(${m[1].trim()} < ${m[2].trim()} && ${m[1].trim()}[1] >= ${m[2].trim()}[1])`,
  ],
  [
    /\bta\.change\s*\(([^)]+)\)/g,
    m => `(${m[1].trim()} - ${m[1].trim()}[1])`,
  ],
];

export const PINE_TYPE_TO_MQL5: Record<string, string> = {
  float: 'double',
  int: 'int',
  bool: 'bool',
  string: 'string',
  color: 'color',
  label: 'string',   // drawing objects represented as name strings in MQL5
  line: 'string',
  box: 'string',
};

export const UNSUPPORTED_PATTERNS: Array<[RegExp, string]> = [
  [/\bdisplay\.\w+/g, 'no equivalent in MQL5, commented out'],
  [/\bbgcolor\s*\(/g, 'not directly convertible, commented out'],
  [/\bbarcolor\s*\(/g, 'no direct MQL5 equivalent, commented out'],
  [/\bbarmerge\.lookahead_on\b/g, 'use shift=1 (confirmed bar) instead, commented out'],
  [/\brequest\.security\s*\([^)]*ta\.[^)]*\)/g, 'custom indicator value retrieval requires manual conversion'],
  [/\bplot\s*\(/g, 'no direct MQL5 equivalent (use indicator buffers), commented out'],
  // plotshape is handled separately by convertPlotshape()
  [/\bplotarrow\s*\(/g, 'no direct MQL5 equivalent, commented out'],
  [/\bhline\s*\(/g, 'no direct MQL5 equivalent, commented out'],
];

import type { TranspileWarning } from './warnings.js';
import { SIMPLE_REPLACEMENTS, TA_MAPPINGS, UNSUPPORTED_PATTERNS, PINE_TYPE_TO_MQL5 } from './mappings.js';
import { resetDrawingCounters, convertChartPoint, convertLineNew, convertBoxNew, convertLabelNew, convertDelete, convertSetColor, convertSetText, convertSetFirstPoint, convertSetSecondPoint, convertSetXY2, generateOnDeinitCleanup } from './drawings.js';
import { resetSessionCounter, parseSessionInput, generateSessionParams, generateSessionHelper, type SessionParam } from './session.js';
import { resetPlotshapeCounter, convertPlotshape } from './plotshape.js';

interface GeneratorState {
  structs: string[];
  globalVars: string[];
  inputParams: string[];
  sessionParams: SessionParam[];
  utilFunctions: string[];
  functions: string[];
  onTickBody: string[];
  warnings: TranspileWarning[];
  insideMethod: boolean;
  insideFunction: boolean;
  braceDepth: number;
  currentFuncLines: string[];
  currentFuncHeader: string;
}

function newState(): GeneratorState {
  return {
    structs: [],
    globalVars: [],
    inputParams: [],
    sessionParams: [],
    utilFunctions: [],
    functions: [],
    onTickBody: [],
    warnings: [],
    insideMethod: false,
    insideFunction: false,
    braceDepth: 0,
    currentFuncLines: [],
    currentFuncHeader: '',
  };
}

function mapType(t: string): string {
  return PINE_TYPE_TO_MQL5[t] ?? t;
}

function applySimpleReplacements(code: string): string {
  let result = code;
  for (const [re, replacement] of SIMPLE_REPLACEMENTS) {
    result = result.replace(re, replacement);
  }
  return result;
}

function applyTaMappings(code: string): string {
  let result = code;
  for (const [re, fn] of TA_MAPPINGS) {
    result = result.replace(re, (...args) => {
      const m = args.slice(0, -2) as string[];
      const match = Object.assign(m, { index: args[args.length - 2], input: args[args.length - 1] });
      return fn(match as RegExpMatchArray);
    });
  }
  return result;
}

function applyDrawingConversions(code: string): string {
  let result = code;

  // chart.point.new(t, na, p) → t, p
  result = result.replace(/chart\.point\.new\(([^)]+)\)/g, (_, args) => convertChartPoint(args));

  // line.new(args) → ObjectCreate
  result = result.replace(/\bline\.new\s*\(([^)]+)\)/g, (_, args) => convertLineNew(args));

  // box.new(args) → ObjectCreate
  result = result.replace(/\bbox\.new\s*\(([^)]+)\)/g, (_, args) => convertBoxNew(args));

  // label.new(args) → ObjectCreate
  result = result.replace(/\blabel\.new\s*\(([^)]+)\)/g, (_, args) => convertLabelNew(args));

  // obj.delete() → ObjectDelete
  result = result.replace(/\b(\w+)\.delete\s*\(\s*\)/g, (_, v) => convertDelete(`"${v}"`));

  // obj.set_xy2(t, p) → ObjectSetInteger/Double
  result = result.replace(/\b(\w+)\.set_xy2\s*\(([^,]+),\s*([^)]+)\)/g,
    (_, v, t, p) => convertSetXY2(`"${v}"`, t.trim(), p.trim()));

  // obj.set_first_point(chart.point...) - simplified
  result = result.replace(/\b(\w+)\.set_first_point\s*\(([^)]+)\)/g,
    (_, v, args) => convertSetFirstPoint(`"${v}"`, args.split(',')[0]?.trim() ?? '', args.split(',')[1]?.trim() ?? ''));

  // obj.set_second_point(chart.point...)
  result = result.replace(/\b(\w+)\.set_second_point\s*\(([^)]+)\)/g,
    (_, v, args) => convertSetSecondPoint(`"${v}"`, args.split(',')[0]?.trim() ?? '', args.split(',')[1]?.trim() ?? ''));

  // obj.set_color(c)
  result = result.replace(/\b(\w+)\.set_color\s*\(([^)]+)\)/g,
    (_, v, c) => convertSetColor(`"${v}"`, c.trim()));

  // obj.set_text(s)
  result = result.replace(/\b(\w+)\.set_text\s*\(([^)]+)\)/g,
    (_, v, s) => convertSetText(`"${v}"`, s.trim()));

  // obj.set_point(args)
  result = result.replace(/\b(\w+)\.set_point\s*\(([^)]+)\)/g,
    (_, v, args) => convertSetFirstPoint(`"${v}"`, args.split(',')[0]?.trim() ?? '', args.split(',')[1]?.trim() ?? ''));

  return result;
}

function convertVarDeclaration(line: string): string | null {
  // var float x = na  →  double x = EMPTY_VALUE;
  const varTyped = line.match(/^var\s+(float|int|bool|string|color)\s+(\w+)\s*=\s*(.+)/);
  if (varTyped) {
    const [, type, name, val] = varTyped;
    const mqlType = mapType(type);
    const mqlVal = val.trim() === 'na' ? 'EMPTY_VALUE' : val.trim();
    return `${mqlType} ${name} = ${mqlVal};`;
  }

  // var array<T> name = array.new<T>()  →  T name[];
  const varArrayM = line.match(/^var\s+array<(\w+)>\s+(\w+)\s*=/);
  if (varArrayM) {
    const [, elemType, name] = varArrayM;
    return `${mapType(elemType)} ${name}[];`;
  }

  // var TypeName name = TypeName.new(...)  →  TypeName name;
  // Matches both UpperCamelCase and alias_prefixed types (e.g. kz_KZ, zz_zzState)
  const varCustom = line.match(/^var\s+(\w[\w<>]*)\s+(\w+)\s*=\s*.+/);
  if (varCustom) {
    const [, type, name] = varCustom;
    const primitives = new Set(['float', 'int', 'bool', 'string', 'color']);
    if (!primitives.has(type)) {
      return `${mapType(type)} ${name};`;
    }
  }

  // var name = value (untyped)
  const varSimple = line.match(/^var\s+(\w+)\s*=\s*(.+)/);
  if (varSimple) {
    const [, name, val] = varSimple;
    const mqlVal = val.trim() === 'na' ? 'EMPTY_VALUE' : val.trim();
    return `double ${name} = ${mqlVal};`;
  }
  return null;
}

function convertTypeDefinition(lines: string[], startIdx: number): { mql5Lines: string[]; endIdx: number } {
  const headerM = lines[startIdx].match(/^type\s+(\w+)/);
  if (!headerM) return { mql5Lines: [], endIdx: startIdx };

  const typeName = headerM[1];
  const structLines: string[] = [`struct ${typeName} {`];
  let i = startIdx + 1;

  while (i < lines.length) {
    const l = lines[i].trim();
    if (!l || l.startsWith('//')) { i++; continue; }
    // Indented field definition (any type: float, int, bool, string, color, or custom/drawing types)
    if (/^\s/.test(lines[i])) {
      const fieldM = l.match(/^(\w[\w<>]*)\s+(\w+)(?:\s*=\s*(.+))?/);
      if (fieldM) {
        const [, fType, fName] = fieldM;
        const mqlType = mapType(fType);
        structLines.push(`   ${mqlType} ${fName};`);
        i++;
        continue;
      }
    }
    break;
  }

  structLines.push('};');
  return { mql5Lines: structLines, endIdx: i - 1 };
}

function convertMethodSignature(line: string): string | null {
  // method func(Foo _id, ...) → void func(Foo &id, ...)
  const m = line.match(/^method\s+(\w+)\s*\((\w+)\s+(\w+)(.*)\)\s*=>/);
  if (!m) return null;
  const [, name, selfType, selfParam, rest] = m;
  const cleanSelf = selfParam.replace(/^_/, '');
  const restParams = rest.trim() ? `, ${convertParams(rest.slice(1))}` : '';
  return `void ${name}(${selfType} &${cleanSelf}${restParams}) {`;
}

function convertFunctionSignature(line: string): string | null {
  // funcName(params) => → return_type funcName(params) {
  const m = line.match(/^(\w+)\s*\(([^)]*)\)\s*=>/);
  if (!m) return null;
  const [, name, params] = m;
  return `void ${name}(${convertParams(params)}) {`;
}

function convertParams(params: string): string {
  if (!params.trim()) return '';
  return params.split(',').map(p => {
    const trimmed = p.trim();
    const m = trimmed.match(/^(float|int|bool|string|color|\w+)\s+(\w+)(?:\s*=\s*.+)?$/);
    if (!m) return trimmed;
    const [, type, name] = m;
    return `${mapType(type)} ${name}`;
  }).join(', ');
}

function convertInputLine(line: string): string | null {
  // input.int(default, 'Label', ...) → input int varName = default;
  const intM = line.match(/^(\w+)\s*=\s*input\.int\s*\(\s*([^,)]+)/);
  if (intM) return `input int ${intM[1]} = ${intM[2].trim()};`;

  const floatM = line.match(/^(\w+)\s*=\s*input\.float\s*\(\s*([^,)]+)/);
  if (floatM) return `input double ${floatM[1]} = ${floatM[2].trim()};`;

  const boolM = line.match(/^(\w+)\s*=\s*input\s*\(\s*(true|false)/);
  if (boolM) return `input bool ${boolM[1]} = ${boolM[2]};`;

  const strM = line.match(/^(\w+)\s*=\s*input\.string\s*\(\s*([^,)]+)/);
  if (strM) return `input string ${strM[1]} = ${strM[2].trim()};`;

  const colorM = line.match(/^(\w+)\s*=\s*input\.color\s*\(\s*([^,)]+)/);
  if (colorM) return `input color ${colorM[1]} = ${colorM[2].trim()};`;

  return null;
}

function isUnsupported(line: string): [boolean, string] {
  for (const [re, reason] of UNSUPPORTED_PATTERNS) {
    if (re.test(line)) {
      re.lastIndex = 0;
      return [true, reason];
    }
  }
  return [false, ''];
}

function isSimpleFunctionCall(line: string): boolean {
  const t = line.trim();
  return /^\w+\s*\(/.test(t) && !t.includes('=>') && !t.includes('=') && !t.includes('if ') && !t.includes('var ');
}

export interface GenerateResult {
  code: string;
  warnings: TranspileWarning[];
}

function joinContinuationLines(lines: string[]): string[] {
  const joined: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Count unmatched open parens
    let depth = 0;
    for (const ch of line) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    if (depth > 0) {
      // Accumulate continuation lines until parens are balanced
      let combined = line;
      i++;
      while (i < lines.length && depth > 0) {
        const next = lines[i].trim();
        for (const ch of next) {
          if (ch === '(') depth++;
          else if (ch === ')') depth--;
        }
        combined += ' ' + next;
        i++;
      }
      joined.push(combined);
    } else {
      joined.push(line);
      i++;
    }
  }
  return joined;
}

export function generateMql5(expandedLines: string[]): GenerateResult {
  resetDrawingCounters();
  resetSessionCounter();
  resetPlotshapeCounter();

  const preprocessed = joinContinuationLines(expandedLines);
  const st = newState();
  let i = 0;

  // Collect indicator metadata
  let indicatorName = 'Untitled';
  const indM = preprocessed.find(l => /^indicator\s*\(/.test(l.trim()));
  if (indM) {
    const nm = indM.match(/indicator\s*\(\s*['"]([^'"]+)['"]/);
    if (nm) indicatorName = nm[1];
  }

  while (i < preprocessed.length) {
    const line = preprocessed[i];
    const trimmed = line.trim();

    // Skip header lines
    if (/^\/\/@version=/.test(trimmed) || /^(indicator|strategy|library)\s*\(/.test(trimmed) || /^\/\/\s*@import/.test(trimmed)) {
      i++;
      continue;
    }

    // Comments and blank lines
    if (!trimmed || trimmed.startsWith('//')) {
      if (st.insideFunction || st.insideMethod) {
        st.currentFuncLines.push(line);
      }
      i++;
      continue;
    }

    // --- Inline block separators (from expander) ---
    if (/^\/\/ --- (inlined from|end inline)/.test(trimmed)) {
      i++;
      continue;
    }

    // --- type definitions ---
    if (/^type\s+\w+/.test(trimmed)) {
      const { mql5Lines, endIdx } = convertTypeDefinition(expandedLines, i);
      st.structs.push(...mql5Lines, '');
      i = endIdx + 1;
      continue;
    }

    // --- method definitions ---
    if (/^method\s+\w+/.test(trimmed)) {
      const sig = convertMethodSignature(trimmed);
      if (sig) {
        st.insideMethod = true;
        st.currentFuncHeader = sig;
        st.currentFuncLines = [];
      }
      i++;
      continue;
    }

    // --- function definitions (funcName(...) =>) ---
    if (/^\w+\s*\(.*\)\s*=>/.test(trimmed)) {
      const sig = convertFunctionSignature(trimmed);
      if (sig) {
        st.insideFunction = true;
        st.currentFuncHeader = sig;
        st.currentFuncLines = [];
      }
      i++;
      continue;
    }

    // --- inside function/method body ---
    if (st.insideFunction || st.insideMethod) {
      // detect end by de-indented non-blank line
      if (trimmed && !/^\s/.test(line) && !/^[\t]/.test(line)) {
        // flush current function
        const funcLines = [st.currentFuncHeader];
        for (const fl of st.currentFuncLines) {
          funcLines.push(convertBodyLine(fl, st.warnings, i));
        }
        funcLines.push('}', '');
        st.functions.push(...funcLines);
        st.insideFunction = false;
        st.insideMethod = false;
        st.currentFuncLines = [];
        // re-process this line
        continue;
      }
      st.currentFuncLines.push(line);
      i++;
      continue;
    }

    // --- var declarations (global) ---
    if (/^var\s+/.test(trimmed)) {
      const converted = convertVarDeclaration(trimmed);
      if (converted) {
        st.globalVars.push(converted);
      } else {
        st.globalVars.push(`// TODO: ${trimmed}`);
      }
      i++;
      continue;
    }

    // --- input.*() declarations ---
    if (/^\w+\s*=\s*input[\s.(]/.test(trimmed)) {
      // session input
      const sess = parseSessionInput(trimmed);
      if (sess) {
        st.sessionParams.push(sess);
        i++;
        continue;
      }
      const inp = convertInputLine(trimmed);
      if (inp) {
        st.inputParams.push(inp);
        i++;
        continue;
      }
    }

    // --- constant assignments (UPPER_CASE = ...) ---
    if (/^[A-Z_][A-Z_0-9]*\s*=/.test(trimmed)) {
      const constM = trimmed.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*(.+)/);
      if (constM) {
        st.globalVars.push(`#define ${constM[1]} ${constM[2]}`);
        i++;
        continue;
      }
    }

    // --- plotshape → ObjectCreate block ---
    const plotshapeM = trimmed.match(/^plotshape\s*\((.+)\)\s*$/);
    if (plotshapeM) {
      st.onTickBody.push(convertPlotshape(plotshapeM[1], '   '));
      i++;
      continue;
    }

    // --- unsupported → comment out + warning ---
    const [unsup, reason] = isUnsupported(trimmed);
    if (unsup) {
      st.onTickBody.push(`   // WARN: ${trimmed}`);
      st.warnings.push({ lineNo: i + 1, original: trimmed.slice(0, 60), reason });
      i++;
      continue;
    }

    // --- simple function calls → OnTick ---
    if (isSimpleFunctionCall(trimmed)) {
      const converted = convertBodyLine(line, st.warnings, i);
      st.onTickBody.push(`   ${converted.trim()}`);
      i++;
      continue;
    }

    // --- if/for/while blocks → OnTick ---
    if (/^(if|for|while)\b/.test(trimmed)) {
      st.onTickBody.push(convertBodyLine(line, st.warnings, i));
      i++;
      continue;
    }

    // --- other top-level expressions → OnTick ---
    const converted = convertBodyLine(line, st.warnings, i);
    if (converted.trim()) {
      st.onTickBody.push(`   ${converted.trim()}`);
    }
    i++;
  }

  // flush pending function
  if (st.insideFunction || st.insideMethod) {
    const funcLines = [st.currentFuncHeader];
    for (const fl of st.currentFuncLines) {
      funcLines.push(convertBodyLine(fl, st.warnings, i));
    }
    funcLines.push('}', '');
    st.functions.push(...funcLines);
  }

  const sessionHelperNeeded = st.sessionParams.length > 0;

  const output: string[] = [
    `// Generated by pinecone transpile`,
    `// Source: ${indicatorName}`,
    `#property copyright ""`,
    `#property strict`,
    '',
  ];

  if (st.structs.length > 0) {
    output.push('// --- Structs ---');
    output.push(...st.structs);
  }

  if (st.globalVars.length > 0) {
    output.push('// --- Global Variables & Constants ---');
    output.push(...st.globalVars, '');
  }

  if (st.inputParams.length > 0 || st.sessionParams.length > 0) {
    output.push('// --- Input Parameters ---');
    output.push(...st.inputParams);
    if (sessionHelperNeeded) {
      output.push(...generateSessionParams(st.sessionParams));
    }
    output.push('');
  }

  if (sessionHelperNeeded) {
    output.push('// --- Session Helper ---');
    output.push(...generateSessionHelper(), '');
  }

  if (st.functions.length > 0) {
    output.push('// --- Functions ---');
    output.push(...st.functions);
  }

  output.push(
    'int OnInit() {',
    '   return INIT_SUCCEEDED;',
    '}',
    '',
    'void OnDeinit(const int reason) {',
    ...generateOnDeinitCleanup(),
    '}',
    '',
    'void OnTick() {',
    ...st.onTickBody,
    '}',
  );

  return { code: output.join('\n'), warnings: st.warnings };
}

function convertBodyLine(line: string, warnings: TranspileWarning[], lineNo: number): string {
  const t = line.trim();
  if (!t || t.startsWith('//')) return line;

  // plotshape → ObjectCreate block
  const plotshapeM = t.match(/^plotshape\s*\((.+)\)\s*$/);
  if (plotshapeM) {
    const indent = line.match(/^(\s*)/)?.[1] ?? '   ';
    return convertPlotshape(plotshapeM[1], indent);
  }

  const [unsup, reason] = isUnsupported(t);
  if (unsup) {
    warnings.push({ lineNo: lineNo + 1, original: t.slice(0, 60), reason });
    return `${line.match(/^(\s*)/)?.[1] ?? ''}// WARN: ${t}`;
  }

  let result = t;
  result = applySimpleReplacements(result);
  result = applyTaMappings(result);
  result = applyDrawingConversions(result);

  // PineScript indentation uses 4 spaces / tabs; preserve leading whitespace
  const indent = line.match(/^(\s*)/)?.[1] ?? '';
  const needsSemicolon = !result.endsWith('{') && !result.endsWith('}') && !result.endsWith(';') && !result.startsWith('//');
  return `${indent}${result}${needsSemicolon ? ';' : ''}`;
}

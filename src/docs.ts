export const DOCS = `
# pinecone — LLM Development Guide

pinecone is a PineScript bundler. It resolves \`// @import\` comments in a main
PineScript file and inlines the referenced modules into a single output file.
TradingView's native parser ignores these comments, so the source files remain
valid PineScript at all times.

---

## CLI commands

\`\`\`
pinecone build <input> [-o <output>]   # bundle and write output file
pinecone lint  <input>                 # dry-run: show renames and warnings
pinecone docs                          # print this guide
\`\`\`

---

## Import syntax

Write the following comment anywhere in the main file (conventionally near the
top, after \`//@version=5\`):

\`\`\`pine
// @import ./relative/path/to/module as <alias>
\`\`\`

Rules:
- The path is relative to the main file.
- **Extension is optional.** pinecone looks for \`.pine\` first, then \`.pinescript\`.
  If the extension is specified explicitly, it is used as-is.
- \`alias\` must be a valid PineScript identifier (letters, digits, underscores).
- Each alias must be unique within the file.
- Multiple imports are allowed.

\`\`\`pine
//@version=5
// @import ./killzones as kz
// @import ./structure as smc
indicator("My Strategy", overlay = true)
\`\`\`

---

## Module file structure

A module file is a standard \`.pinescript\` file. The following lines are
**excluded** from inlining (they belong only to the module's standalone run):

- \`//@version=5\`
- \`indicator(...)\` / \`strategy(...)\` / \`library(...)\`
- \`// @import ...\` lines

Everything else is inlined verbatim after renaming.

Typical module layout:

\`\`\`pine
//@version=5
indicator("My Module")          ← excluded from inline

type MyType                      ← inlined, renamed
    float value

myVar = input(true, "Enable")   ← inlined, renamed

method compute(MyType self) =>   ← inlined, renamed
    self.value * 2

var MyType inst = MyType.new()  ← inlined, renamed
\`\`\`

---

## Renaming rules

When a module is imported as \`alias\`, **every top-level identifier** defined in
the module receives the prefix \`alias_\`:

| What               | Before             | After                  |
|--------------------|--------------------|------------------------|
| type               | \`type KZ\`          | \`type alias_KZ\`        |
| method             | \`method plot(KZ _id, ...)\` | \`method alias_plot(alias_KZ _id, ...)\` |
| function           | \`swings(len)\`      | \`alias_swings(len)\`    |
| var (with type)    | \`var KZ kz = KZ.new()\` | \`var alias_KZ alias_kz = alias_KZ.new()\` |
| var (inferred)     | \`var arr = array.new<int>()\` | \`var alias_arr = array.new<int>()\` |
| simple assignment  | \`myColor = input(...)\` | \`alias_myColor = input(...)\` |

**Not renamed:**
- type field names (\`lnT\`, \`value\`, etc.)
- function parameter names (\`_id\`, \`len\`, etc.)
- PineScript built-ins (\`math\`, \`ta\`, \`array\`, \`color\`, \`line\`, etc.)
- string literals
- comments

Renaming is applied inside the module body too, so all internal references
stay consistent after inlining.

---

## Calling module functions from the main file

In the main file, use \`alias.identifier\` syntax to reference anything from the
module. During build, \`alias.X\` is rewritten to \`alias_X\`:

\`\`\`pine
// main file
kz.plot(high, low, time, color.blue)   →   kz_plot(high, low, time, color.blue)
kz.MyType                              →   kz_MyType
\`\`\`

This applies to any \`alias.<identifier>\` pattern — function calls, type names,
variable references.

---

## Full example

### Module: \`killzones.pinescript\`

\`\`\`pine
//@version=5
indicator("Killzones")

type KZ
    line  lnTop
    line  lnBot

kzColor = input.color(color.new(#00bcd4, 80), "Color")

method draw(KZ self, bool active, float h, float l, int t) =>
    if active and not active[1]
        self.lnTop := line.new(t, h, t, h, xloc.bar_time, color = kzColor)
        self.lnBot := line.new(t, l, t, l, xloc.bar_time, color = kzColor)
    if active
        self.lnTop.set_xy2(t, h)
        self.lnBot.set_xy2(t, l)

var KZ kz = KZ.new()
nyam = not na(time(timeframe.period, "0830-1100", "UTC-5"))
kz.draw(nyam, high, low, time)
\`\`\`

### Main: \`main.pinescript\`

\`\`\`pine
//@version=5
// @import ./killzones as kz
indicator("My Strategy", overlay = true)

// kz module state is already running via its own inlined code.
// To reference its type in the main file:
// var kz.KZ myKz = kz.KZ.new()  →  var kz_KZ myKz = kz_KZ.new()
\`\`\`

### Output after \`pinecone build main.pinescript\`

\`\`\`pine
//@version=5
indicator("My Strategy", overlay = true)

// --- inlined from ./killzones.pinescript ---
type kz_KZ
    line  lnTop
    line  lnBot

kz_kzColor = input.color(color.new(#00bcd4, 80), "Color")

method kz_draw(kz_KZ self, bool active, float h, float l, int t) =>
    if active and not active[1]
        self.lnTop := line.new(t, h, t, h, xloc.bar_time, color = kz_kzColor)
        self.lnBot := line.new(t, l, t, l, xloc.bar_time, color = kz_kzColor)
    if active
        self.lnTop.set_xy2(t, h)
        self.lnBot.set_xy2(t, l)

var kz_KZ kz_kz = kz_KZ.new()
kz_nyam = not na(time(timeframe.period, "0830-1100", "UTC-5"))
kz_kz.kz_draw(kz_nyam, high, low, time)
// --- end inline ---
\`\`\`

---

## Module design guidelines

1. **One concern per module.** A module should represent a single logical
   feature (killzones, order blocks, fair value gaps, etc.).

2. **Self-contained execution.** A module may include its own \`var\` state and
   calculation code at the bottom. This code runs automatically when inlined.
   There is no need to call it from the main file unless you need extra
   parameterisation.

3. **Expose via method or function.** If the main file needs to drive the
   module's logic with different parameters, define a \`method\` or function and
   call it as \`alias.funcName(...)\` in the main file.

4. **Avoid name collisions.** All identifiers are prefixed, so collisions
   between modules are rare. However, avoid single-letter identifiers like
   \`b\`, \`i\` at the top level of a module — they may conflict with similar
   names in other modules after prefixing.

5. **Limitations to be aware of:**
   - \`indicator()\` must fit on one line (multi-line calls shift the insertion point).
   - Tuple assignment \`[a, b] = func()\` — left-side variables are not collected
     for renaming.
   - Nested imports (a module importing another module) are not yet supported.

---

## Using lint before build

Always run \`pinecone lint\` first to verify:
- All imported files exist.
- Rename preview looks correct.
- No \`alias.X\` references in the main file point to undefined identifiers.

\`\`\`
pinecone lint main.pinescript
\`\`\`
`.trim();

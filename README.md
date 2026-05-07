# pinecone 🌲

PineScript bundler — inlines imported modules into a single file.

TradingView の PineScript はネイティブの `import` でローカルファイルを読み込めません。
`pinecone` は独自の `// @import` コメント構文を使って複数ファイルを1つに結合します。

## How it works

```
// @import ./my_module.pinescript as mod
```

`pinecone build` を実行すると、モジュールの内容が **インライン展開** され、識別子に `mod_` プレフィックスが付与されます。

| 変換前 | 変換後 |
|---|---|
| `type KZ` | `type mod_KZ` |
| `method plot(KZ _id, ...)` | `method mod_plot(mod_KZ _id, ...)` |
| `mod.plot(...)` (メインファイル) | `mod_plot(...)` |

## Installation

```bash
pnpm install
```

## Usage

```bash
# 開発時 (ビルド不要)
pnpm tsx src/cli.ts build <input.pinescript> -o <output.pine>

# CLIとしてビルドして使う
pnpm build
node dist/cli.js build <input.pinescript> -o <output.pine>
```

## Import syntax

メインファイルに以下のコメントを書きます（PineScript 本体のパーサには無視されます）。

```pine
//@version=5
// @import ./path/to/module.pinescript as mymod
indicator("My Script", overlay = true)
```

## Example

**`examples/killzone_lib.pinescript`** (モジュール)

```pine
//@version=5
indicator("KZ Lib")

type KZ
    line lnT
    line lnB

method plot(KZ _id, bool _active, float _h, float _l, int _t, color _c) =>
    if _active and not _active[1]
        _id.lnT := line.new(_t, _h, _t, _h, xloc.bar_time, color = _c)
        _id.lnB := line.new(_t, _l, _t, _l, xloc.bar_time, color = _c)
```

**`examples/main.pinescript`** (メイン)

```pine
//@version=5
// @import ./killzone_lib.pinescript as kz
indicator("My Strategy", overlay = true)

kz.plot(...)
```

**ビルド実行**

```bash
pnpm tsx src/cli.ts build examples/main.pinescript -o examples/output.pine
```

**`examples/output.pine`** (出力)

```pine
//@version=5
indicator("My Strategy", overlay = true)

// --- inlined from ./killzone_lib.pinescript ---
type kz_KZ
    line lnT
    line lnB

method kz_plot(kz_KZ _id, bool _active, float _h, float _l, int _t, color _c) =>
    ...
// --- end inline ---

kz_plot(...)
```

## Project Structure

```
src/
├── types.ts     # 共有型定義
├── parser.ts    # import 解析・識別子収集
├── renamer.ts   # リネームマップ構築・適用
├── inliner.ts   # インライン展開ブロック生成
├── builder.ts   # ビルドオーケストレーター
└── cli.ts       # CLI エントリポイント
```

## License

MIT

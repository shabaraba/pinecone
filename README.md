# pinecone 🌲

PineScript bundler — inlines imported modules into a single file.

TradingView の PineScript はネイティブの `import` でローカルファイルを読み込めません。
`pinecone` は独自の `// @import` コメント構文を使って複数ファイルを1つに結合します。

## How it works

```
// @import ./my_module as mod
```

`pinecone build` を実行すると、モジュールの内容が **インライン展開** され、識別子に `mod_` プレフィックスが付与されます。

| 変換前 | 変換後 |
|---|---|
| `type KZ` | `type mod_KZ` |
| `method plot(KZ _id, ...)` | `method mod_plot(mod_KZ _id, ...)` |
| `mod.plot(...)` (メインファイル) | `mod_plot(...)` |

## Installation

```bash
git clone https://github.com/shabaraba/pinecone
cd pinecone
pnpm install && pnpm build
pnpm link --global
```

## Usage

```bash
pinecone build <input> [-o <output>]   # インライン展開して出力
pinecone lint  <input>                 # ドライラン：リネーム内容と警告を表示
pinecone docs                          # LLM向け開発ガイドを表示
```

## Import syntax

メインファイルに以下のコメントを書きます（PineScript 本体のパーサには無視されます）。

```pine
//@version=5
// @import ./path/to/module as mymod
indicator("My Script", overlay = true)
```

- **拡張子は省略可能。** `.pine` → `.pinescript` の順で自動検索します。
- 拡張子を明示した場合（`./module.pine`）はそのまま使用します。

## Example

**`killzones.pine`** (モジュール)

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

**`main.pine`** (メイン)

```pine
//@version=5
// @import ./killzones as kz
indicator("My Strategy", overlay = true)

kz.plot(...)
```

**ビルド実行**

```bash
pinecone build main.pine -o output.pine
```

**`output.pine`** (出力)

```pine
//@version=5
indicator("My Strategy", overlay = true)

// --- inlined from ./killzones.pine ---
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
├── types.ts      # 共有型定義
├── parser.ts     # import 解析・識別子収集
├── renamer.ts    # リネームマップ構築・適用
├── inliner.ts    # インライン展開ブロック生成
├── resolver.ts   # モジュールパス解決（拡張子自動検索）
├── builder.ts    # ビルドオーケストレーター
├── linter.ts     # ビルド可否チェック・リネームプレビュー
└── cli.ts        # CLI エントリポイント
```

## License

MIT

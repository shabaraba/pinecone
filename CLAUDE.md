# pinecone — CLAUDE.md

## 概要

PineScript のモジュールを1ファイルにインライン展開するCLIツール。
コンパイルではなく**プリプロセッサ**に近い役割。

## 開発コマンド

```bash
pnpm install                         # 依存関係インストール
pnpm tsx src/cli.ts build <input>    # 開発時実行（ビルド不要）
pnpm build                           # dist/ にバンドル
```

## アーキテクチャ

処理の流れ: `cli.ts` → `builder.ts` → `parser.ts` / `renamer.ts` / `inliner.ts`

| ファイル | 責務 |
|---|---|
| `src/parser.ts` | `// @import` の解析、識別子（型・関数・変数名）の収集、ヘッダ行の除外 |
| `src/renamer.ts` | リネームマップの構築と適用（文字列リテラル・コメント内は変換しない） |
| `src/inliner.ts` | リネーム済みコンテンツをセパレータコメントで囲む |
| `src/builder.ts` | ファイル読み込み・処理フロー制御・出力組み立て |
| `src/cli.ts` | Commander による CLIコマンド定義 |

## import 構文

```pine
// @import ./path/to/module.pinescript as alias
```

- PineScript コメントなので TradingView のパーサには無視される
- `alias` はリネームプレフィックスになる（例: `alias` → 識別子に `alias_` が付く）

## リネームルール

モジュール内の識別子を収集して全てプレフィックス付与する。

- `type KZ`  → `type alias_KZ`
- `method killzones(KZ _id, ...)` → `method alias_killzones(alias_KZ _id, ...)`
- `var KZ kz = KZ.new()` → `var alias_KZ alias_kz = alias_KZ.new()`
- メインファイルの `alias.X` → `alias_X`

文字列リテラル（`'...'` `"..."`、エスケープ対応）とコメント（`//` 以降）は変換対象外。

## 既知の制限

- `indicator()` が複数行にわたる場合、インライン展開の挿入位置がずれる可能性がある
- タプル代入 `[a, b] = func()` の左辺変数は収集されない
- ネストされた import（モジュール内の import）は未対応

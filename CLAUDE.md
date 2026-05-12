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

処理の流れ: `cli.ts` → `builder.ts` / `linter.ts` → `parser.ts` / `renamer.ts` / `inliner.ts`

| ファイル | 責務 |
|---|---|
| `src/parser.ts` | `// @import` の解析、識別子（型・関数・変数名）の収集、ヘッダ行の除外 |
| `src/renamer.ts` | リネームマップの構築と適用（文字列リテラル・コメント内は変換しない） |
| `src/inliner.ts` | リネーム済みコンテンツをセパレータコメントで囲む |
| `src/resolver.ts` | モジュールパス解決（拡張子省略時に `.pine` → `.pinescript` の順で検索） |
| `src/builder.ts` | ファイル読み込み・処理フロー制御・出力組み立て |
| `src/linter.ts` | ビルド可否チェック・リネーム内容の表示・未定義参照の警告 |
| `src/cli.ts` | Commander による CLIコマンド定義 |
| `src/lsp.ts` | LSPサーバー起動・機能登録（definition / hover / references） |
| `src/lsp-server.ts` | LSPサーバーエントリポイント（stdio経由で起動） |
| `src/lsp/definition.ts` | go-to-definition: `@import` 行・`alias.X` / `alias::X` パターン・型フィールドへのジャンプ |
| `src/lsp/hover.ts` | hover: `@import` 行上でモジュールの型・関数・変数一覧を表示 |
| `src/lsp/references.ts` | references: 識別子の全参照をディレクトリ内の `.pine` / `.pinescript` ファイルから検索 |
| `src/lsp/utils.ts` | LSP共通ユーティリティ（トークン取得・エイリアスマップ構築・定義行検索） |

## LSPサーバー

`pinecone lsp` コマンドで stdio ベースの LSP サーバーを起動できる。

### 対応機能

| 機能 | 動作 |
|---|---|
| **go-to-definition** | `// @import` 行 → モジュールファイルの先頭へジャンプ |
| | `alias.X` / `alias::X` → モジュール内の定義行へジャンプ |
| | `変数.フィールド` → 型定義のフィールド行へジャンプ |
| | alias 単体 → インポートファイルへジャンプ |
| | カレントファイル内の識別子 → 同ファイル内定義へジャンプ |
| **hover** | `// @import` 行上でモジュールの型・関数・変数の一覧を Markdown 表示 |
| **references** | カーソル下の識別子の全参照をディレクトリ内 `.pine` / `.pinescript` ファイルから列挙 |

### エディタ設定（Neovim 例）

```lua
vim.api.nvim_create_autocmd('FileType', {
  pattern = { 'pine', 'pinescript' },
  callback = function()
    vim.lsp.start({
      name = 'pinecone',
      cmd = { 'pinecone', 'lsp' },
      root_dir = vim.fn.getcwd(),
    })
  end,
})
```

## import 構文

```pine
// @import ./path/to/module as alias
```

- PineScript コメントなので TradingView のパーサには無視される
- **拡張子は省略可能。** `.pine` → `.pinescript` の順で自動検索。明示した場合はそのまま使用
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

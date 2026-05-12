# Changelog

## [1.1.0](https://github.com/shabaraba/pinecone/compare/v1.0.0...v1.1.0) (2026-05-12)


### Features

* add PineScript LSP server with go-to-definition support ([973bced](https://github.com/shabaraba/pinecone/commit/973bcedaaed6826572b33ae2368a496d82e6c293))
* add transpile command for PineScript to MQL5 EA conversion ([3cce1c2](https://github.com/shabaraba/pinecone/commit/3cce1c237a3d07d980dc4e68cf39bac3c149bcd9))

## 1.0.0 (2026-05-08)


### ⚠ BREAKING CHANGES

* module member references now use `alias::X` syntax instead of `alias.X` to avoid conflicts with PineScript built-in dot-notation.

### Features

* add docs command for LLM development guide ([a02f3fd](https://github.com/shabaraba/pinecone/commit/a02f3fdd9f4c44a1c78918d64861429f7ef4e04b))
* add lint command with rename preview and undefined reference warnings ([a01e86b](https://github.com/shabaraba/pinecone/commit/a01e86b843b0ea54444eb697665a2fb283ab0402))
* detect alias conflicts in lint before build ([51e83f2](https://github.com/shabaraba/pinecone/commit/51e83f24088c76b9efdedd49e3933c63233c2fe1))
* initial implementation of pinecone PineScript bundler ([35ee367](https://github.com/shabaraba/pinecone/commit/35ee367d69b55bb2ca58d4b8a11608b106d9699d))
* support extension-less imports (.pine then .pinescript fallback) ([95bd892](https://github.com/shabaraba/pinecone/commit/95bd892a55536f38e7a0015d6098130085e592aa))
* use :: operator for module refs, support nested imports with topological ordering ([a2140a3](https://github.com/shabaraba/pinecone/commit/a2140a31ef89e9a76086b7b30f2d365cf1a5587d))

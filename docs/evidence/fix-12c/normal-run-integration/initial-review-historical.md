# FIX-12C Runtime canonical normal-run integration

Development-source implementation; no commit, release, version or dependency change. Runtime baseline `13ecc2d847d9cba99ae03386ffa1aeb9013060d0`.

`createRuntime` now composes canonical `createExecutor`. Structural replay target and separate Act/Operation replay handle signatures delegate directly; normal application replay remains explicitly gated elsewhere pending review. Tests were ported to canonical Execution v7 operands/addresses and historical-result isolation rather than retaining Execution v6 compatibility.

Verification: **12/12 Runtime tests passed**, including native localhost HTTP, explicit cookie binding/no carryover, POST, network/status/timeout failures, cancellation, lexical inputs, structural output transfer, nested Operation and canonical replay delegation with immutable parent results. Strict source typecheck and emitted development-source build passed. Source-profile commands use `.cache/normal-test.config.mjs`, `.cache/normal-source-tsconfig.json`, `.cache/normal-build-tsconfig.json`; full logs/profiles archived here.

`implementation.diff`, `regressions.diff`, `changed-source-files.txt` and `repository-state.json` are exact review records. `preserved-runtime-facade-source.txt` preserves the original facade source for review. Existing Runtime info version text remains `0.1.0-alpha.7` while manifest is `0.1.0`; that preexisting presentation mismatch was not treated as authorization to change a version.

Central report: Studio `docs/evidence/fix-12c/normal-run-integration/README.md`. Runner contains native IPC/HTTP receipts and the failing retained obsolete-suite logs. No complete application cutover or registry acceptance is claimed.

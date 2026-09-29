# QAick Runtime — Alpha 1 Development Plan

Status: **ACTIVE — RT9 Runner desktop migration next**

## Purpose

QAick Runtime is the reusable, host-neutral composition layer for QAick execution domains.

> **Runtime assembles. Executor orchestrates. Act Executors perform.**

Runtime remains independent of Electron, React, Vite, Express, Fastify and any specific host protocol.

## Current cross-repository status

- QAick Executor Alpha 1: **Complete**.
- QAick HTTP Executor Alpha 1: **Complete**, including H11 Desktop Host acceptance.
- Runtime RT0 package boundary: **Complete**.
- Runtime RT1 composition extraction: **Complete**.
- Runtime RT2 API/lifecycle: **Complete for current Executor boundary**.
- Runtime RT3 Node HTTP composition: **Complete**.
- Runtime RT4 headless Node acceptance: **Complete**.
- Runtime RT5 host adapter boundary: **Complete**.
- Runtime RT6 Desktop Host: **Complete through QAICK Studio Alpha 10**.
- Runtime RT7 desktop native acceptance: **Complete through QAICK Studio Alpha 10**.
- Runtime RT8 IPC Runtime Client: **Proven through QAICK Studio Alpha 10; canonical type-boundary cleanup remains**.
- Runtime RT9 Runner desktop migration: **NEXT**.
- Runtime RT10 Studio readiness: **Complete; Studio Alpha 10 itself is complete**.

## Proven architecture

```text
UI / Process
    ↓
QaickRuntimeClient
    ↓
Desktop / future Server / CLI Host
    ↓
QAick Runtime
    ↓
QAick Executor
    ↓
Act Executors
    ↓
HTTP Executor
    ↓
HttpTransport
```

Studio Alpha 10 proves the first concrete desktop path:

```text
Studio React/Vite
      ↓
IpcRuntimeClient
      ↓ IPC
Electron Desktop Host
      ↓
QAick Runtime
      ↓
Executor
      ↓
HTTP Executor
      ↓
NodeHttpTransport
```

Native acceptance covers localhost HTTP, custom response headers, HTTP/network failure distinction, cancellation, ordered events/results and a multi-step response-binding chain without Runner.

## Domain boundaries

Runtime owns composition, registration/configuration, execution-handle lifecycle, execute/cancel/control routing, event subscription/routing, live result access and capability metadata.

Runtime does not own Routine orchestration semantics, HTTP semantics, Electron UI integration, server protocols, Runner UI policy, Studio editor state, durable historical Run Result persistence or Analyzer evaluation.

Executor and HTTP Executor must not depend on Runtime.

## Milestone status

### RT0 — Standalone package
Status: **Complete**

`@qaick/runtime` is a standalone TypeScript/Node package with no UI/host-framework dependency.

### RT1 — Runtime composition extraction
Status: **Complete**

Runtime composition lives at the Runtime boundary rather than being owned by Executor.

### RT2 — Runtime API/lifecycle
Status: **Complete for current Executor boundary**

Execution, cancellation, control, events, result and capability behavior are available through the host-neutral Runtime surface.

### RT3 — HTTP Executor + Node transport composition
Status: **Complete**

Host-side composition proves Runtime → Executor → HTTP Executor → NodeHttpTransport.

### RT4 — Headless Node acceptance
Status: **Complete**

Plain Node acceptance proves nested execution, bindings, events, retry/control, cancellation, localhost HTTP/custom headers, POST, HTTP status failure, timeout and network failure without browser/Electron/Studio/Runner.

### RT5 — Host adapter boundary
Status: **Complete**

Runtime APIs do not assume IPC, REST, WebSocket or CLI protocol details.

### RT6 — Desktop Host Alpha 1
Status: **Complete through QAICK Studio Alpha 10**

Studio is the first concrete Desktop Host. Electron main owns Runtime lifetime and exposes a narrow preload/IPC bridge with context isolation and no unrestricted renderer Node access.

### RT7 — Desktop native execution acceptance
Status: **Complete through QAICK Studio Alpha 10**

Studio native acceptance proves localhost, custom headers including `x-auth-token`, HTTP/transport failure distinction, cancellation, ordered events/results and multi-step binding. This also closes HTTP Executor H11.

### RT8 — Runtime Client stabilization
Status: **Functionally proven; canonical type-boundary cleanup pending**

Studio implements `IpcRuntimeClient` and consumes Runtime through the client seam rather than direct renderer execution.

One release-boundary cleanup remains: Studio currently contains `src/runtime/runtime-types.ts`, a local copy/shim of types that are already exported by the canonical `@qaick/runtime` public declaration surface. This must not become an independent semantic contract.

Required cleanup:

1. identify the renderer/package-resolution reason for the shim;
2. restore canonical `import type` consumption from `@qaick/runtime` where possible;
3. if necessary, expose a renderer-safe type-only shared subpath/package rather than duplicating interfaces;
4. remove the Studio shim after build/typecheck parity;
5. add a compatibility check preventing Runtime/consumer type drift.

This cleanup does not invalidate RT6/RT7 functional acceptance.

### RT9 — Runner integration
Status: **NEXT — in-process Runtime path exists; desktop migration remains**

Migrate Runner to the same proven desktop/client architecture while preserving its richer controls:

```text
Runner React/Vite
      ↓
QaickRuntimeClient
      ↓ IPC
Electron Desktop Host
      ↓
QAick Runtime
```

Preserve breakpoints, pause/resume, Step/Continue, retry Action/Operation, Run From Here, Stop After, pause-aware timing, history/export/redaction and existing parity behavior.

Do not blindly copy Studio host code. First identify the minimal reusable host/client pieces. If real duplication is clear across Studio and Runner, extract shared Electron/preload/IPC infrastructure at that point.

**Exit:** Runner parity remains green through the Desktop Runtime Client path and direct application-path Executor composition is removed.

### RT10 — Studio integration readiness
Status: **Complete**

Studio has moved beyond readiness: Alpha 10 implements and packages the first complete desktop Runtime consumer with Live Run and result-pane integration.

## Immediate next sequence

```text
1. Clean canonical Runtime type consumption
        ↓
2. Plan Runner desktop host/client migration
        ↓
3. Add Runner Electron host using proven Runtime boundary
        ↓
4. Add/consume IpcRuntimeClient
        ↓
5. Preserve Runner advanced controls across IPC
        ↓
6. Run Runner parity + native desktop acceptance
        ↓
7. Decide whether shared @qaick/desktop-host extraction is justified
        ↓
8. Close RT9
        ↓
9. Close Runtime Alpha 1 release gate
```

## Release gate

Before broader Runtime package publication/distribution:

- canonical public Runtime types must be consumable without copied consumer contracts;
- package tarball/build must contain the intended declarations/files;
- a clean host consumer must resolve the package without sibling-repo assumptions;
- Studio and Runner desktop paths should consume the same Runtime semantics;
- Executor peer dependency range must align with the published Executor release.

## Non-goals for Alpha 1

No durable Run Result repository, Analyzer evaluation, Server Host authentication, multi-user scheduling, distributed workers, cloud execution proxy, new Routine/Operation/Act semantics, or terminology serialization migration.

> **Runtime Alpha 1 has proven headless and Studio desktop execution. Runner desktop migration is the final major consumer gate.**

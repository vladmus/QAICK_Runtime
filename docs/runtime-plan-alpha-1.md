# QAick Runtime — Alpha 1 Development Plan

Status: **ACTIVE — RT9 Runner desktop migration next**

## Purpose

QAick Runtime is the reusable, host-neutral composition layer for QAick execution domains.

> **Runtime assembles. Executor orchestrates. Act Executors perform.**

Runtime remains independent of Electron, React, Vite, Express, Fastify and any specific host protocol.

## Current cross-repository status

- QAick Executor Alpha 1: **Complete**.
- QAick HTTP Executor Alpha 1: **Complete**, including H11 Desktop Host acceptance.
- Runtime RT0–RT7: **Complete**.
- Runtime RT8 IPC Runtime Client: **Functionally proven through Studio; canonical type-boundary cleanup is planned in Studio**.
- Runtime RT9 Runner desktop migration: **NEXT; canonical implementation plan is `QAICK_Runner_FE/docs/runner-plan-alpha-5.md`**.
- Runtime RT10 Studio readiness: **Complete; Studio Alpha 10 is complete**.

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

Studio Alpha 10 proves the first concrete desktop path with Electron main owning Runtime and native Node HTTP execution. Native acceptance covers localhost, custom response headers, HTTP/network failure distinction, cancellation, ordered events/results and multi-step response binding.

## Milestone status

### RT0 — Standalone package
**Complete.** `@qaick/runtime` is a standalone host-neutral TypeScript/Node package.

### RT1 — Runtime composition extraction
**Complete.** Runtime composition is owned by Runtime rather than Executor.

### RT2 — Runtime API/lifecycle
**Complete for current Executor boundary.** Execution, cancellation, control, events, results and capability behavior are available through Runtime.

### RT3 — HTTP Executor + Node transport composition
**Complete.** Runtime composition proves Executor → HTTP Executor → NodeHttpTransport.

### RT4 — Headless Node acceptance
**Complete.** Plain Node acceptance proves nested execution, bindings, events, retry/control, cancellation and native HTTP behavior without browser/Electron/Studio/Runner.

### RT5 — Host adapter boundary
**Complete.** Runtime APIs do not assume IPC, REST, WebSocket or CLI protocol details.

### RT6 — Desktop Host Alpha 1
**Complete through QAICK Studio Alpha 10.** Studio is the first concrete Desktop Host.

### RT7 — Desktop native execution acceptance
**Complete through QAICK Studio Alpha 10.** This also closes HTTP Executor H11.

### RT8 — Runtime Client stabilization
**Functionally proven; canonical type-boundary cleanup pending.** Studio's `IpcRuntimeClient` proves the client seam. The cleanup is now explicitly planned in `QAICK_Studio_FE/docs/runtime-type-boundary-cleanup-plan.md`.

The rule is that Runtime contracts have one owner. Studio may use renderer-safe type-only imports or an appropriate shared type-only export, but must not retain independent semantic copies.

### RT9 — Runner integration
**NEXT.** The canonical implementation plan is `QAICK_Runner_FE/docs/runner-plan-alpha-5.md`.

Runner Alpha 5 will:

1. freeze the current Runner baseline;
2. add the Electron shell;
3. host QAick Runtime in Electron main;
4. use the IPC `QaickRuntimeClient` boundary;
5. migrate the normal execution path;
6. preserve breakpoints, pause/resume, Step/Continue, retry Act/Operation, Run From Here, Stop After, cancellation and pause-aware timing;
7. pass native execution and full Runner parity gates;
8. package a self-contained desktop Runner;
9. compare Studio and Runner host implementations;
10. decide from evidence whether `@qaick/desktop-host` extraction is justified.

**Exit:** Runner parity remains green through the Desktop Runtime Client path and direct application-path Executor composition is removed.

### RT10 — Studio integration readiness
**Complete.** Studio Alpha 10 implements and packages the first complete desktop Runtime consumer with Live Run and result-pane integration.

## Immediate next sequence

```text
Studio type-boundary cleanup
        ↓
Runner Alpha 5 R5.0 baseline
        ↓
R5.1 Electron shell
        ↓
R5.2 Runtime in Electron main
        ↓
R5.3 IPC Runtime Client
        ↓
R5.4 core execution migration
        ↓
R5.5 advanced control parity
        ↓
R5.6 native execution acceptance
        ↓
R5.7 full Runner parity
        ↓
R5.8 desktop packaging
        ↓
R5.9 compare Studio/Runner hosts
        ↓
R5.10 extraction decision
        ↓
Close RT9 / Runtime Alpha 1 gate
```

## Release gate

Before broader Runtime package publication/distribution:

- canonical Runtime types are consumable without copied consumer contracts;
- package tarball/build contains intended declarations/files;
- a clean host consumer resolves the package without sibling-repo assumptions;
- Studio and Runner desktop paths consume the same Runtime semantics;
- Executor peer dependency range aligns with the published Executor release.

## Non-goals for Alpha 1

No durable Run Result repository, Analyzer evaluation, Server Host authentication, multi-user scheduling, distributed workers, cloud execution proxy, new Routine/Operation/Act semantics, or terminology serialization migration.

> **Runtime Alpha 1 has proven headless and Studio desktop execution. Runner Alpha 5 is the final major consumer gate.**

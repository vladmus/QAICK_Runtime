# QAick Runtime — Alpha 1 Development Plan

Status: **ACTIVE — RT9 unified QAick Desktop Runner integration next**

## Purpose

QAick Runtime is the reusable, host-neutral composition layer for QAick execution domains.

> **Runtime assembles. Executor orchestrates. Act Executors perform.**

Runtime remains independent of Electron, React, Vite and specific host protocols.

## Product architecture clarification

QAick Studio and QAick Runner are **modules of one QAick Desktop application**, not separately installed desktop applications.

Studio happened to implement the first Electron/Desktop Host because Studio reached native Live Run first. That physical placement does not mean Studio conceptually owns a private desktop platform.

Target:

```text
QAick Desktop
┌──────────────────────────────────────────────┐
│             Single Electron Host             │
│                                              │
│      Studio module      Runner module        │
│           │                  │               │
│           └────────┬─────────┘               │
│                    ▼                         │
│            QaickRuntimeClient                │
│                    │ IPC                     │
│────────────────────┼─────────────────────────│
│                    ▼                         │
│               QAick Runtime                  │
│                    │                         │
│               QAick Executor                 │
│                    │                         │
│              Act Executors                   │
└────────────────────┼─────────────────────────┘
                     ▼
                  Real APIs
```

There should not be a Studio Electron host plus a Runner Electron host in the intended desktop product.

## Current status

- Executor Alpha 1: **Complete**.
- HTTP Executor Alpha 1: **Complete**.
- RT0–RT7: **Complete**.
- RT8 Runtime Client: **Functionally proven through Studio; canonical type-boundary cleanup pending**.
- RT9 Runner integration: **NEXT**, now defined as integration into the existing single QAick Desktop Host.
- RT10 Studio readiness: **Complete**.

## Milestones

### RT0 — Standalone package
**Complete.**

### RT1 — Runtime composition extraction
**Complete.**

### RT2 — Runtime API/lifecycle
**Complete for current Executor boundary.**

### RT3 — HTTP Executor + Node transport composition
**Complete.**

### RT4 — Headless Node acceptance
**Complete.**

### RT5 — Host adapter boundary
**Complete.** Runtime does not assume IPC/REST/WebSocket/CLI.

### RT6 — First Desktop Host
**Complete through Studio Alpha 10.** Studio supplied the first physical implementation of the **QAick Desktop Host**.

### RT7 — Desktop native execution acceptance
**Complete through Studio Alpha 10.** Localhost, custom headers, failure distinction, cancellation, events/results and multi-step bindings are proven; HTTP Executor H11 is closed.

### RT8 — Runtime Client stabilization
**Functionally proven; type-boundary cleanup pending.** Studio proves `IpcRuntimeClient`. Canonical Runtime contracts remain owned by Runtime; Studio's temporary local type shim must be eliminated through the dedicated cleanup plan.

### RT9 — Runner integration into QAick Desktop
**NEXT.** Canonical implementation plan: `QAICK_Runner_FE/docs/runner-plan-alpha-5.md`.

RT9 no longer means creating a Runner Electron application. It means adding Runner as another product module behind the existing QAick Desktop shell and Runtime Client boundary.

Required outcome:

```text
Studio ──┐
         ├── QaickRuntimeClient → one Desktop Host → one Runtime
Runner ──┘
```

Runner's advanced controls may require extending the canonical Runtime/IPC client surface, but must not create a private execution path.

**Exit:** Runner executes/debugs through the same QAick Desktop Runtime path, all advanced controls retain parity, and direct Runner application-path Executor composition is removed.

### RT10 — Studio integration readiness
**Complete.** Studio Alpha 10 is already a full desktop Runtime consumer.

## Immediate next sequence

```text
1. Studio Runtime type-boundary cleanup
        ↓
2. Runner R5.0 baseline + integration inventory
        ↓
3. Define Runner module boundary in existing QAick Desktop
        ↓
4. Reuse/extend shared QaickRuntimeClient + IPC
        ↓
5. Migrate Runner core execution
        ↓
6. Preserve advanced Runner controls
        ↓
7. Integrate Runner UI/navigation into QAick Desktop
        ↓
8. Native + parity acceptance
        ↓
9. Package ONE QAick Desktop with Studio + Runner
        ↓
10. Decide neutral physical ownership of the single Desktop shell
        ↓
11. Close RT9 / Runtime Alpha 1 release gate
```

## Desktop Host ownership

Because Studio implemented the shell first, Electron code currently lives with Studio. After Runner integration, decide whether this code should remain there temporarily or move to a neutral `QAICK_Desktop` repository/package.

This is **not** a decision about extracting duplicated Studio/Runner hosts. There is only one intended host. It is a decision about where that shared product shell should live physically.

Future modules such as Analyzer and Mock Server should be able to join the same desktop product rather than each creating another Electron application.

## Release gate

Before broader Runtime package publication/distribution:

- canonical Runtime types are consumed without duplicated semantic contracts;
- package declarations/files are correct;
- a clean host consumer resolves Runtime without sibling-repo assumptions;
- Studio and Runner consume the same Runtime semantics through the single desktop host;
- Runner advanced controls pass parity;
- Executor dependency versions align with published releases.

## Non-goals

No second Runner Electron host, no separately packaged Runner desktop product, no durable Run Result repository redesign, no Analyzer evaluation redesign, no Server Host authentication/multi-user scheduling, and no new Routine/Operation/Act semantics.

> **One QAick Desktop. One Desktop Host. One Runtime. Multiple product modules.**

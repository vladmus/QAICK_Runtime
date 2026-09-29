# QAick Runtime — Alpha 1 Development Plan

Status: **ACTIVE — RT9 Runner dual-composition integration next**

## Purpose

QAick Runtime is the reusable, host-neutral composition layer for QAick execution domains.

> **Runtime assembles. Executor orchestrates. Act Executors perform. Hosts compose.**

Runtime remains independent of Electron, React, Vite and specific host protocols.

## Product architecture clarification

Runner has **two supported compositions**:

1. Runner integrated as a module inside the full QAick Desktop application alongside Studio.
2. Runner as a separately runnable/distributable standalone application.

The requirement is **one Runner implementation, two compositions**, not two Runner codebases.

```text
                       Shared Runner implementation
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
              QAick Desktop              Standalone Runner
          Studio + Runner module             Runner
                    │                           │
             Runtime Client               Runtime Client
                    │                           │
          shared Desktop Host          standalone composition
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
                            QAick Runtime
                                  ↓
                            QAick Executor
                                  ↓
                            Act Executors
```

QAick Desktop itself has one Desktop Host shared by its modules. Standalone Runner may have its own host/composition because it is independently deployable, but Runner module logic must remain shared and depend on the same Runtime Client contract.

## Current status

- Executor Alpha 1: **Complete**.
- HTTP Executor Alpha 1: **Complete**.
- RT0–RT7: **Complete**.
- RT8 Runtime Client: **Functionally proven through Studio; canonical type-boundary cleanup pending**.
- RT9 Runner integration: **NEXT**, requiring both integrated and standalone Runner acceptance.
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
**Complete through Studio Alpha 10.** Studio supplied the first physical implementation of the QAick Desktop Host.

### RT7 — Desktop native acceptance
**Complete through Studio Alpha 10.** HTTP Executor H11 is closed.

### RT8 — Runtime Client stabilization
**Functionally proven; type-boundary cleanup pending.** Studio proves `IpcRuntimeClient`. Canonical Runtime contracts remain Runtime-owned; the Studio shim cleanup is separately planned.

### RT9 — Runner dual-composition integration
**NEXT.** Canonical implementation plan: `QAICK_Runner_FE/docs/runner-plan-alpha-5.md`.

RT9 requires:

```text
Integrated:
Runner module → QaickRuntimeClient → QAick Desktop Host → Runtime

Standalone:
Runner module → QaickRuntimeClient → standalone host/composition → Runtime
```

Both paths must preserve the same Runner UI/control implementation and Runtime semantics.

Runner's richer control needs may extend the canonical Runtime Client/IPC surface, but neither composition may retain a private legacy execution engine.

**RT9 exit:**

- Runner works inside QAick Desktop;
- standalone Runner remains independently runnable/distributable;
- both use one shared Runner implementation;
- both use the canonical Runtime Client contract;
- advanced controls retain parity in both modes;
- native execution acceptance passes in both modes;
- direct legacy Runner application-path Executor composition is removed.

### RT10 — Studio integration readiness
**Complete.** Studio Alpha 10 is already a full desktop Runtime consumer.

## Immediate next sequence

```text
1. Studio Runtime type-boundary cleanup
        ↓
2. Runner baseline + composition inventory
        ↓
3. Separate reusable Runner module from standalone bootstrap
        ↓
4. Make Runner depend on canonical QaickRuntimeClient
        ↓
5. Mount Runner module inside QAick Desktop
        ↓
6. Migrate standalone Runner to same Runtime Client semantics
        ↓
7. Extend Runtime/client controls for Runner
        ↓
8. Integrated Runner native/control acceptance
        ↓
9. Standalone Runner native/control acceptance
        ↓
10. Shared Runner parity gate
        ↓
11. Package QAick Desktop AND standalone Runner
        ↓
12. Normalize genuinely shared host infrastructure
        ↓
13. Close RT9 / Runtime Alpha 1 release gate
```

## Host ownership

QAick Desktop has one host shared by Studio, Runner and future integrated modules. Electron code currently lives with Studio because Studio implemented it first; physical ownership can later move to a neutral QAICK_Desktop location.

Standalone Runner is a separate deployment composition and may require its own bootstrap/host. Shared host infrastructure may be extracted once both compositions reveal what is genuinely common.

Future Analyzer and Mock Server modules can join QAick Desktop without eliminating their ability to have separate service/process deployments where their product requirements justify it.

## Release gate

Before broader Runtime package publication/distribution:

- canonical Runtime types are consumed without duplicated semantic contracts;
- package declarations/files are correct;
- clean consumers resolve Runtime without sibling-repo assumptions;
- integrated Studio/Runner use the same QAick Desktop Runtime semantics;
- standalone Runner uses the same Runtime Client semantics;
- Runner advanced controls pass in both compositions;
- Executor dependency versions align with published releases.

## Non-goals

No second Runner implementation, no removal of standalone Runner, no requirement for standalone Runner to include Studio, no durable Run Result repository redesign, no Analyzer evaluation redesign, no Server Host implementation, and no new Routine/Operation/Act semantics.

> **One Runner implementation. Two compositions. One Runtime model.**

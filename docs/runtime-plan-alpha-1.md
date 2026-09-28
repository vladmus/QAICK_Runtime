# QAick Runtime — Alpha 1 Development Plan

Status: **ACTIVE — RT0 next**

## Purpose

QAick Runtime is the reusable, host-neutral composition layer for QAick execution domains.

It is not a second execution engine.

> **Runtime assembles. Executor orchestrates. Act Executors perform.**

Runtime composes `@qaick/executor`, Act Executors such as `@qaick/http-executor`, host-appropriate transports, execution lifecycle/handles, events/results/controls, and a stable API consumed by hosts.

Runtime remains independent of Electron, React, Vite, Express, Fastify and any specific deployment protocol.

## Current cross-repository baseline

As of the start of Runtime Alpha 1 implementation:

- QAICK Executor Alpha 1: **Complete**.
- QAICK HTTP Executor H8 native Node transport: **Complete**.
- QAICK HTTP Executor H9 host-neutral transport selection: **Complete**.
- QAICK HTTP Executor H10 shared Executor integration fixture: **Complete**.
- QAICK HTTP Executor H11 Desktop Host acceptance: **Blocked until Desktop Host exists**.
- QAICK HTTP Executor H12 future Server/CLI host readiness: **Complete**.
- QAICK Runtime repository: plan exists; implementation package does not yet exist.

Important correction: RT3 no longer exists to unblock HTTP Executor H10. H10 has already been proven by the HTTP Executor package integration fixture. RT3 now proves that the actual Runtime composition uses the same architecture.

## Canonical architecture

```text
UI / Process
    ↓
QaickRuntimeClient
    ↓
Desktop / Server / CLI Host
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

## Domain boundaries

Runtime owns composition of Executor and Act Executors, registration/configuration, execution-handle lifecycle, routing of execute/cancel/control, event subscription/routing, live result retrieval, capability/info reporting, and the stable host-facing Runtime API.

Runtime does not own Routine orchestration semantics, bindings/scopes/Control Blocks, HTTP semantics, Electron UI integration, server protocols, Runner breakpoint policy, Studio editor state, durable historical Run Result persistence in Alpha 1, or Analyzer evaluation logic.

Executor and HTTP Executor must not depend on Runtime.

## Alpha 1 goal

Produce standalone `@qaick/runtime` that can instantiate Executor, register HTTP Executor, use native Node HTTP transport, execute headlessly in Node, expose stable execution/control/event/result APIs, support a Desktop Host through a narrow adapter, and remain reusable by future Server and CLI/CI hosts.

## Implementation sequence

### RT0 — Establish standalone package and dependency boundary
Status: **NEXT / Not started**

Create the real `@qaick/runtime` TypeScript/Node package in QAICK_Runtime. It must build/typecheck independently, depend on QAick execution packages, and contain no Electron/React/Vite/Express/Fastify dependency.

**Exit:** package builds independently and dependency scan confirms host neutrality.

### RT1 — Move temporary Runtime composition out of QAICK_Executor
Status: Not started

Inspect the temporary `QAICK_Executor/runtime` implementation and migrate reusable Runtime composition into QAICK_Runtime rather than duplicating it. Preserve behavior, prove parity, then remove active Runtime ownership from Executor.

**Exit:** Runtime composes Executor successfully and no duplicate active Runtime implementation remains in Executor.

### RT2 — Runtime API and lifecycle
Status: Not started

Define the small stable Runtime boundary: execute, cancel, control, events, result and runtime info/capabilities. Reuse Executor semantics rather than redefining them. Runtime-level failures must remain distinct from Act/Executor failures.

Conceptual API:

```ts
interface QaickRuntime {
  execute(request: RuntimeExecuteRequest): Promise<ExecutionHandle>;
  cancel(executionId: string): Promise<void>;
  control(executionId: string, command: RuntimeControlCommand): Promise<void>;
  events(executionId: string): AsyncIterable<RuntimeEvent>;
  result(executionId: string): Promise<ExecutionResult>;
  info(): RuntimeInfo;
}
```

**Exit:** fake/in-memory Act execution works through Runtime with ordered events and terminal result.

### RT3 — Compose HTTP Executor + Node transport through Runtime
Status: Not started

Runtime constructs/configures `HttpActionExecutor` with `NodeHttpTransport` and registers it with Executor. Transport construction remains injectable/configurable.

This is **Runtime composition verification**. HTTP Executor H10 is already complete independently.

**Exit:** Runtime performs a real local HTTP request through Executor → HTTP Executor → NodeHttpTransport, including custom response headers, without browser CORS.

### RT4 — Headless Node acceptance gate
Status: Not started

This is the critical checkpoint before desktop work.

Prove from a plain Node test/script, with no browser/Electron/Runner/Studio:

1. simple Routine/Flow execution;
2. nested Operation;
3. response-to-later-request binding;
4. HTTP GET;
5. HTTP POST JSON;
6. custom response header;
7. localhost endpoint;
8. HTTP 4xx/5xx;
9. network failure;
10. timeout;
11. cancellation;
12. execution events;
13. result retrieval;
14. retry/control mechanisms required by Runner.

**Exit:** QAick execution platform works headlessly through `@qaick/runtime`.

> **Do not start Electron before RT0–RT4 are green.**

### RT5 — Host adapter boundary
Status: Not started

Keep Runtime protocol-neutral. Define how a host maps its transport/protocol onto Runtime without putting IPC/REST/WebSocket concepts into Runtime itself.

**Exit:** no Runtime public API assumes a particular host protocol.

### RT6 — Desktop Host Alpha 1
Status: Not started

Implement the first concrete host using Electron with context isolation, preload bridge, narrow typed QAick API and no unrestricted renderer Node access.

```text
React/Vite UI
    ↓
QaickRuntimeClient
    ↓ IPC
Electron Desktop Host
    ↓
QAick Runtime
```

**Exit:** execute/control/events/results cross IPC correctly.

### RT7 — Desktop native execution acceptance
Status: Not started

Verify localhost, endpoints without browser CORS permission, custom response headers such as `x-auth-token`, 4xx/5xx response semantics, cancellation and event/result streaming.

**Exit:** Desktop Host proves native execution and closes QAICK_HTTP_Executor H11.

### RT8 — Runtime Client stabilization
Status: Not started

Stabilize UI-facing `QaickRuntimeClient` so applications do not import Electron APIs.

```text
QaickRuntimeClient
    ├── IpcRuntimeClient       ← Alpha 1
    └── HttpRuntimeClient      ← future Server Host
```

**Exit:** React/Vite applications depend only on Runtime Client abstraction.

### RT9 — Runner integration
Status: Not started

Migrate QAICK_Runner_FE from direct Executor/HTTP Executor construction to `QaickRuntimeClient → Desktop Host → Runtime`. Preserve breakpoint/pause/resume, Step/Continue, retry Action/Operation, Run From Here, Stop After, pause-aware timing, history/export/redaction and existing parity behavior.

**Exit:** Runner parity suite remains green and direct application-path Executor composition is removed.

### RT10 — Studio integration readiness
Status: Not started

Expose everything Studio needs to execute saved/live Routines through the same Runtime Client. Studio keeps editing/local UI concerns; Runtime owns live execution composition. No historical result repository is introduced into Studio by this step.

**Exit:** Studio can migrate to the same Runtime Client with no Runner-specific Runtime assumptions.

## Immediate execution order

```text
RT0 package scaffold
 ↓
RT1 migrate temporary Runtime code
 ↓
RT2 Runtime API/lifecycle
 ↓
RT3 HTTP composition
 ↓
RT4 headless Node acceptance     ← first major gate
 ↓
RT5 host boundary
 ↓
RT6 Electron Desktop Host
 ↓
RT7 native desktop acceptance    ← closes HTTP H11
 ↓
RT8 Runtime Client
 ↓
RT9 Runner migration
 ↓
RT10 Studio readiness
```

## Non-goals for Alpha 1

No durable Run Result repository, Analyzer evaluation, Server Host authentication, multi-user scheduling, distributed workers, third-party plugin discovery, cloud execution proxy, new Routine/Operation/Act semantics, or terminology serialization migration.

## Completion criteria

Runtime Alpha 1 is complete when the standalone package composes Executor and HTTP Executor with Node transport, works headlessly, exposes stable execution/control/event/result APIs, stays host-neutral, is exposed by a secure Desktop Host, has a stable Runtime Client, passes desktop native acceptance including H11, and can be consumed by Runner and then Studio without redesigning lower execution domains.

> **One QAick Runtime. Multiple hosts. Shared execution semantics everywhere.**

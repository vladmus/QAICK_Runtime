# QAick Runtime — Alpha 1 Development Plan

Status: planned

## Purpose

QAick Runtime is the reusable, host-neutral composition layer for QAick execution domains.

It is not a second execution engine.

> **Runtime assembles. Executor orchestrates. Act Executors perform.**

QAick Runtime composes:

- `@qaick/executor`
- Act Executors such as `@qaick/http-executor`
- host-provided transports
- execution lifecycle and handle management
- events, results and controls
- a stable Runtime API consumed by different hosts

The Runtime must remain independent of Electron, React, Vite, Express, Fastify, and any specific deployment protocol.

## Canonical architecture

```text
                    QAick Runtime
                         │
              ┌──────────┴──────────┐
              │                     │
        QAick Executor        Act Executors
                                   │
                           ┌───────┴────────┐
                           │                │
                    HTTP Executor       future...
                           │
                     HttpTransport
```

Hosts sit above Runtime:

```text
                         UI / Process
                              │
                     QaickRuntimeClient
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
       Desktop Host      Server Host       CLI/CI Host
       Electron/IPC      HTTP/WebSocket        Node
             │                │                │
             └────────────────┼────────────────┘
                              ▼
                        QAick Runtime
```

## Domain boundaries

### QAick Runtime owns

- composition of Executor and Act Executors;
- registration/configuration of Act Executors and transports;
- execution handle lifecycle;
- routing of execute/cancel/control requests;
- routing/subscription of execution events;
- retrieval of live `ExecutionResult`;
- runtime identity/version/capability reporting;
- stable host-facing Runtime API.

### QAick Runtime does not own

- Routine/Flow orchestration semantics;
- bindings, scopes or Control Blocks;
- HTTP request/response semantics;
- Electron or desktop UI integration;
- REST/WebSocket server protocol implementation;
- Runner breakpoint policy;
- Studio editor state;
- durable Run Result persistence in Alpha 1;
- Analyzer evaluation logic.

## Dependency direction

```text
@qaick/contract
      │
      ▼
@qaick/executor
      ▲
      │
@qaick/http-executor
      ▲
      │
      └────────── @qaick/runtime
```

More precisely, Runtime depends on Executor and concrete Act Executor packages it chooses to compose.

Executor and HTTP Executor must not depend on Runtime.

## Alpha 1 goal

Produce a reusable `@qaick/runtime` package that can:

1. instantiate QAick Executor;
2. register QAick HTTP Executor;
3. use the native Node HTTP transport;
4. execute QAick behavior headlessly in Node;
5. expose a stable runtime API;
6. support a Desktop Host through a narrow IPC adapter;
7. remain ready for future Server and CLI/CI hosts.

## Public API direction

The initial API should remain small.

Conceptually:

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

A UI-facing client contract should mirror the same capabilities without exposing host details:

```ts
interface QaickRuntimeClient {
  execute(request: RuntimeExecuteRequest): Promise<ExecutionHandle>;
  cancel(executionId: string): Promise<void>;
  control(executionId: string, command: RuntimeControlCommand): Promise<void>;
  subscribe(executionId: string, listener: RuntimeEventListener): Unsubscribe;
  getResult(executionId: string): Promise<ExecutionResult>;
  getRuntimeInfo(): Promise<RuntimeInfo>;
}
```

The exact type names can evolve during implementation, but the separation between Runtime and Runtime Client must remain.

## Alpha 1 implementation sequence

### RT0 — Establish package and dependency boundary

Status: Not started

Create the standalone package:

```text
@qaick/runtime
```

Requirements:

- standalone TypeScript/Node package;
- depends on `@qaick/executor`;
- depends on or composes `@qaick/http-executor`;
- no Electron/React/Vite dependency;
- no Express/Fastify dependency;
- builds and typechecks independently.

Exit evidence:

- package builds independently;
- dependency scan confirms no application/host framework imports.

### RT1 — Move Runtime composition out of QAICK_Executor

Status: Not started

Current temporary Runtime code under `QAICK_Executor/runtime` should be migrated into this repository rather than duplicated.

Requirements:

- preserve current behavior while moving;
- remove Runtime ownership from QAICK_Executor after parity is proven;
- Executor remains independently consumable.

Exit evidence:

- Runtime package composes Executor successfully;
- no duplicate active Runtime implementation remains in QAICK_Executor.

### RT2 — Define Runtime types and lifecycle

Status: Not started

Define:

- runtime execution request;
- execution handle/id;
- runtime event mapping;
- control commands;
- result access;
- runtime capability/info model;
- runtime-level failures distinct from Act/Executor failures.

Runtime should not redefine Executor semantics unnecessarily.

Exit evidence:

- fake/in-memory Act Executor can execute through Runtime;
- ordered events and terminal result are observable through Runtime API.

### RT3 — Compose HTTP Executor with Node transport

Status: Not started

Register `HttpActionExecutor` using `NodeHttpTransport`.

Requirements:

- Runtime owns composition;
- HTTP Executor owns HTTP semantics;
- host owns environment/network placement;
- transport construction is injectable/configurable.

Exit evidence:

- headless Node execution performs a real local HTTP request;
- custom response headers are available;
- execution does not depend on browser CORS.

This step completes the practical QAICK_HTTP_Executor H10 integration gate.

### RT4 — Headless acceptance gate

Status: Not started

Before Electron exists, prove Runtime works directly in Node.

Acceptance scenarios:

1. simple Flow/Routine execution;
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

Exit evidence:

- Runtime can be used from a plain Node script/test with no browser or Electron.

### RT5 — Define host adapter boundary

Status: Not started

Keep Runtime communication protocol-neutral.

Define host-side adapter responsibilities without implementing server protocols yet.

Conceptually:

```text
Host Adapter
   ↓
QAick Runtime
```

The Desktop Host will map IPC calls onto Runtime. A future Server Host will map HTTP/WebSocket calls onto the same Runtime API.

Exit evidence:

- no Runtime public API assumes IPC, REST or WebSocket.

### RT6 — Desktop Host Alpha 1

Status: Not started

Implement the first concrete host using Electron.

Architecture:

```text
React/Vite UI
    ↓
QaickRuntimeClient
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

Security requirements:

- renderer has no unrestricted Node access;
- use preload/context isolation;
- expose a narrow typed QAick bridge;
- do not expose arbitrary filesystem/process/network APIs;
- avoid logging secrets across IPC.

Exit evidence:

- renderer invokes Runtime through IPC;
- execution events/results return through IPC;
- cancellation/control cross the boundary.

### RT7 — Desktop native execution acceptance

Status: Not started

Verify from the Electron-hosted UI:

1. localhost API works;
2. endpoint without browser CORS permission works;
3. custom header such as `x-auth-token` is visible to bindings/results;
4. normal 4xx/5xx remains a response, not a transport failure;
5. cancellation works;
6. event/result streaming works.

This step provides the missing QAICK_HTTP_Executor H11 acceptance evidence.

### RT8 — Runtime Client package/API stabilization

Status: Not started

Stabilize the UI-facing abstraction so Runner and Studio depend on Runtime Client rather than Electron directly.

Expected implementations:

```text
QaickRuntimeClient
    ├── IpcRuntimeClient       ← Alpha 1
    └── HttpRuntimeClient      ← future Server Host
```

Exit evidence:

- React/Vite application code imports the Runtime Client abstraction, not Electron APIs.

### RT9 — Runner integration

Status: Not started

Migrate QAICK_Runner_FE from direct `@qaick/executor` composition to:

```text
Runner UI
   ↓
QaickRuntimeClient
   ↓
Desktop Host
   ↓
QAick Runtime
```

Preserve:

- breakpoint/pause/resume;
- Step/Continue;
- retry Action/Operation;
- Run From Here;
- Stop After;
- timing;
- history/export/redaction.

Exit evidence:

- existing Runner Alpha 4 parity suite remains green through Runtime;
- direct Runner construction of Executor/HTTP Executor is removed from the application path.

### RT10 — Studio integration readiness

Status: Not started

Provide the Runtime Client/host APIs required by Studio Alpha 10.

Do not implement Studio UI features in this repository.

Exit evidence:

- Studio can later execute through the same Runtime Client used by Runner;
- no Runner-specific assumptions exist in Runtime.

## Future host readiness

### Server Host

Future:

```text
Browser
  ↓ HTTPS/WebSocket
QAick Server Host
  ↓
QAick Runtime
```

Server Host concerns such as authentication, authorization, multi-user isolation, secrets and shared persistence are outside Runtime Alpha 1.

### CLI/CI Host

Future:

```text
qaick CLI / pipeline
        ↓
QAick Runtime
        ↓
Executor + Act Executors
```

No Chromium/Electron dependency should be required.

## Versioning and package policy

The Runtime should be independently versioned.

Initial package direction:

```text
@qaick/runtime
0.1.0-alpha.1
```

During local development, sibling `file:` dependencies are acceptable.

Before broader distribution, Runtime should consume versioned/published QAick packages rather than requiring sibling repositories on disk.

## Non-goals for Alpha 1

Do not add:

- durable Run Result repository;
- Analyzer evaluation;
- Server Host authentication;
- multi-user scheduling;
- distributed worker pools;
- dynamic third-party plugin discovery;
- cloud execution proxy;
- new Routine/Operation/Act semantics;
- terminology serialization migration.

## Completion criteria

Runtime Alpha 1 is complete when:

1. `@qaick/runtime` is a standalone package/repository.
2. Runtime composes `@qaick/executor` without duplicating orchestration.
3. Runtime composes `@qaick/http-executor` with native Node transport.
4. Runtime works headlessly in Node.
5. Runtime exposes stable execution, cancel, control, events and result APIs.
6. Runtime contains no Electron/React/Vite/server-framework dependency.
7. Electron Desktop Host exposes Runtime through a narrow IPC boundary.
8. `QaickRuntimeClient` isolates application UI from host transport.
9. native desktop execution passes localhost/CORS/custom-header acceptance.
10. HTTP Executor H10 and H11 integration gates are satisfied.
11. Runner can migrate to Runtime Client without losing Alpha 4 behavior.
12. future Server and CLI/CI hosts can reuse Runtime without redesigning Executor or HTTP Executor.

> **One QAick Runtime. Multiple hosts. Shared execution semantics everywhere.**

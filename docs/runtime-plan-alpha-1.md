# QAick Runtime — Alpha 1 Development Plan

Status: **ACTIVE — RT6 blocked on Desktop Host**

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
- QAICK Runtime RT0 package scaffold: **Complete**.
- QAICK Runtime RT1 composition wrapper and public routing tests: **Complete for the current Executor boundary**.
- QAICK Runtime RT2 basic execution/control/event/result API: **Complete for the current Executor boundary**.
- QAICK Runtime RT3 Node HTTP composition fixture: **Complete**.
- QAICK Runtime RT4 headless acceptance gate: **Complete**.
- QAICK Runtime RT5 in-process host adapter boundary: **Complete**.
- Runner in-process Runtime Client and Executor-backed migration: **Complete; Desktop adapter remains pending**.

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

## Review snapshot and decisions

The repository already contains the RT0 package scaffold, a typed `QaickRuntime` wrapper around the Executor interface, public re-exports for host composition, and passing in-memory composition tests. The next implementation gate is HTTP composition through the existing Action Executor injection point.

The Runtime package owns composition and lifecycle routing. A host owns construction of environment-specific resources such as `NodeHttpTransport`, and passes the resulting Action Executor into `createRuntime`. This keeps the package usable in Node, Electron, Server and CLI hosts without importing a host framework or a transport implementation into the core Runtime boundary.

The plan therefore treats the following as separate concerns:

- Runtime core: stable API, registration, lifecycle routing and capability metadata.
- Host composition: Node transport construction and registration of `HttpActionExecutor`.
- Acceptance fixtures: end-to-end proof that the two layers work together.
- Desktop and client work: follow only after the headless gate is green.

## Concrete implementation steps

### 1. Freeze the Runtime core boundary — RT0/RT1

Deliverables:

- Keep `createRuntime(configuration)` as the only core construction entry point.
- Keep `Executor` injectable for deterministic tests and host-specific composition.
- Keep `registerActionExecutor`, execution, control, event, result, retry and Run From Here routing as thin delegation over the Executor interface.
- Ensure Runtime production sources contain no Electron, React, Vite, Express, Fastify, HTTP server or browser transport imports.
- Add a package dependency check that fails when a host framework enters the core package.

Verification:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm pack --dry-run`

Exit evidence: the package builds independently, exposes only the host-neutral API, and the composition tests pass.

### 2. Complete the Runtime API contract — RT2

Deliverables:

- Document the request, run handle, event, result and control semantics exposed by the current Executor types.
- Add `info()` or an equivalent capability query only if a host needs Runtime-owned metadata; do not duplicate Executor result or control types.
- Define how Runtime construction and registration failures are reported separately from action and execution failures.
- Add tests for missing request IDs, unknown action executors, control routing, terminal results and repeated result access.

Verification: the public API has one source of truth for execution semantics, and the tests cover normal, invalid and terminal lifecycle paths.

### 3. Add a Node HTTP composition fixture — RT3

Deliverables:

- Add a host-side fixture or example that creates `HttpActionExecutor(new NodeHttpTransport())` and passes it through `createRuntime({ actionExecutors })`.
- Keep `NodeHttpTransport` construction outside the Runtime core package.
- Execute a local HTTP request through Runtime → Executor → HTTP Executor → Node transport.
- Verify response body mapping, extracted fields and custom response headers.

Verification: the fixture runs in plain Node with no browser or Electron globals and uses a local test server.

### 4. Build the headless acceptance gate — RT4

Deliverables:

- Create a deterministic local HTTP server fixture with success, JSON POST, custom-header, 4xx/5xx, delayed and closed-endpoint routes.
- Add Runtime-level scenarios for simple Flow execution, nested Operation, bindings, timeout, cancellation, events, result retrieval and required retry/control operations.
- Assert semantic states, outputs, errors, event ordering and terminal reasons while ignoring timestamps.
- Record the scenario matrix and command used to run it in the plan.

Verification: the complete headless suite passes from a plain Node process before any Desktop Host work begins.

### 5. Stabilize the host adapter boundary — RT5

Deliverables:

- Define a small adapter contract for a host to expose Runtime operations.
- Keep IPC, REST, WebSocket and CLI protocol types outside Runtime.
- Define request correlation, event subscription lifetime, cancellation and disposal behavior for adapters.
- Add an in-process adapter test that exercises the same contract as a future Desktop adapter.

Exit evidence: a host can replace the adapter transport without changing Runtime or Executor semantics.

### 6. Implement Desktop Host Alpha 1 — RT6/RT7

Deliverables:

- Implement the Electron main-process composition with context isolation enabled.
- Construct the Node transport and HTTP Action Executor in the host process.
- Expose a narrow typed preload bridge for execute, control, events, results and cancellation.
- Add native acceptance coverage for localhost, custom headers, HTTP errors, cancellation and event/result streaming.

Dependency: RT0–RT5 must be green, and the Desktop Host must live in its owning application or host repository rather than this core package.

### 7. Stabilize the Runtime Client and migrate consumers — RT8/RT9/RT10

Deliverables:

- Define `QaickRuntimeClient` independently of Electron APIs.
- Implement the in-process client first, then the Desktop IPC client.
- Migrate Runner execution paths while preserving breakpoints, pause/resume, retry, Run From Here, Stop After, timing, history, export and redaction behavior.
- Provide the same client boundary for Studio without moving editor or persistence concerns into Runtime.

Verification: Runner parity remains green, direct application-path Executor construction is removed, and Studio can consume the client without Runner-specific assumptions.

### 8. Publish and consume the package — release gate

Deliverables:

- Publish the package only after the headless gate passes and the tarball contains the intended built files.
- Consume the published `@qaick/runtime` version from a host smoke test instead of a local sibling path.
- Keep the Executor peer dependency version range aligned with the published Executor release.

Verification: a clean consumer install resolves the package and its peer dependency, and the smoke test executes a fixture successfully.

## Implementation sequence

### RT0 — Establish standalone package and dependency boundary
Status: **Complete**

Create the real `@qaick/runtime` TypeScript/Node package in QAICK_Runtime. It must build/typecheck independently, depend on QAick execution packages, and contain no Electron/React/Vite/Express/Fastify dependency.

**Exit:** package builds independently and dependency scan confirms host neutrality.

### RT1 — Move temporary Runtime composition out of QAICK_Executor
Status: **Complete for the current Executor boundary**

Inspect the temporary `QAICK_Executor/runtime` implementation and migrate reusable Runtime composition into QAICK_Runtime rather than duplicating it. Preserve behavior, prove parity, then remove active Runtime ownership from Executor.

**Exit:** Runtime composes Executor successfully and no duplicate active Runtime implementation remains in Executor.

### RT2 — Runtime API and lifecycle
Status: **Complete for the current Executor boundary**

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
Status: **Complete**

The host composition fixture constructs/configures `HttpActionExecutor` with `NodeHttpTransport` and registers it with Runtime. Transport construction remains outside the Runtime core package and injectable/configurable at the host boundary.

This is **Runtime composition verification**. HTTP Executor H10 is already complete independently.

**Exit:** Runtime performs a real local HTTP request through Executor → HTTP Executor → NodeHttpTransport, including custom response headers, without browser CORS.

### RT4 — Headless Node acceptance gate
Status: **Complete**

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

Current evidence: the Runtime acceptance suite covers nested Operation child results, bindings, ordered events, retry, Run From Here, cancellation, localhost GET with custom headers, JSON POST, HTTP status failure, timeout and network failure. The suite contains 10 passing tests across three files.

**Exit:** QAick execution platform works headlessly through `@qaick/runtime`.

> **Do not start Electron before RT0–RT4 are green.**

### RT5 — Host adapter boundary
Status: **Complete for the in-process adapter**

Keep Runtime protocol-neutral. Define how a host maps its transport/protocol onto Runtime without putting IPC/REST/WebSocket concepts into Runtime itself.

The existing Runner `QaickRuntimeClient` is the in-process adapter: it aliases the host-neutral Runtime surface and constructs it through `createLocalRuntimeClient`. IPC, REST and WebSocket adapters remain outside the Runtime package.

**Exit:** no Runtime public API assumes a particular host protocol.

### RT6 — Desktop Host Alpha 1
Status: **Blocked — Desktop Host does not exist in the workspace**

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
Status: **Blocked by RT6**

Verify localhost, endpoints without browser CORS permission, custom response headers such as `x-auth-token`, 4xx/5xx response semantics, cancellation and event/result streaming.

**Exit:** Desktop Host proves native execution and closes QAICK_HTTP_Executor H11.

### RT8 — Runtime Client stabilization
Status: **Complete for the in-process client; Desktop client pending RT6**

Stabilize UI-facing `QaickRuntimeClient` so applications do not import Electron APIs.

```text
QaickRuntimeClient
    ├── IpcRuntimeClient       ← Alpha 1
    └── HttpRuntimeClient      ← future Server Host
```

**Exit:** React/Vite applications depend only on Runtime Client abstraction.

### RT9 — Runner integration
Status: **Complete for the in-process Runtime path; Desktop migration pending RT6**

Migrate QAICK_Runner_FE from direct Executor/HTTP Executor construction to `QaickRuntimeClient → Desktop Host → Runtime`. Preserve breakpoint/pause/resume, Step/Continue, retry Action/Operation, Run From Here, Stop After, pause-aware timing, history/export/redaction and existing parity behavior.

**Exit:** Runner parity suite remains green and direct application-path Executor composition is removed.

### RT10 — Studio integration readiness
Status: **Not started; authoring baseline verified**

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

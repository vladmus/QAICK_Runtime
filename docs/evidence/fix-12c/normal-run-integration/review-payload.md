CODEX → SOL — CANONICAL NORMAL-RUN INTEGRATION REVIEW PAYLOAD — QAICK_Runtime



## README.md

# FIX-12C Runtime canonical normal-run integration

Development-source implementation; no commit, release, version or dependency change. Runtime baseline `13ecc2d847d9cba99ae03386ffa1aeb9013060d0`.

`createRuntime` now composes canonical `createExecutor`. Structural replay target and separate Act/Operation replay handle signatures delegate directly; normal application replay remains explicitly gated elsewhere pending review. Tests were ported to canonical Execution v7 operands/addresses and historical-result isolation rather than retaining Execution v6 compatibility.

Verification: **12/12 Runtime tests passed**, including native localhost HTTP, explicit cookie binding/no carryover, POST, network/status/timeout failures, cancellation, lexical inputs, structural output transfer, nested Operation and canonical replay delegation with immutable parent results. Strict source typecheck and emitted development-source build passed. Source-profile commands use `.cache/normal-test.config.mjs`, `.cache/normal-source-tsconfig.json`, `.cache/normal-build-tsconfig.json`; full logs/profiles archived here.

`implementation.diff`, `regressions.diff`, `changed-source-files.txt` and `repository-state.json` are exact review records. `preserved-runtime-facade-source.txt` preserves the original facade source for review. Existing Runtime info version text remains `0.1.0-alpha.7` while manifest is `0.1.0`; that preexisting presentation mismatch was not treated as authorization to change a version.

Central report: Studio `docs/evidence/fix-12c/normal-run-integration/README.md`. Runner contains native IPC/HTTP receipts and the failing retained obsolete-suite logs. No complete application cutover or registry acceptance is claimed.


## implementation.diff

diff --git a/src/index.ts b/src/index.ts
index a09a536..0d86926 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -10,6 +10,10 @@ export type {
   ExecutorRequest,
   ExecutorResult,
   ExecutorRun,
+  ActReplayTarget,
+  ActReplayHandle,
+  OperationReplayHandle,
+  ExecutorStepResult,
 } from '@qaick/executor';
 
 export { resolveDeclaredInputs } from '@qaick/executor';
diff --git a/src/runtime.ts b/src/runtime.ts
index 26dafbc..cd18e1c 100644
--- a/src/runtime.ts
+++ b/src/runtime.ts
@@ -1,4 +1,4 @@
-import { createMigratedExecutor } from '@qaick/executor';
+import { createExecutor } from '@qaick/executor';
 import type {
   ActionExecutor,
   ControlCommand,
@@ -9,6 +9,9 @@ import type {
   ExecutorRequest,
   ExecutorResult,
   ExecutorRun,
+  ActReplayTarget,
+  ActReplayHandle,
+  OperationReplayHandle,
 } from '@qaick/executor';
 
 export interface RuntimeConfiguration extends ExecutorConfiguration {
@@ -41,14 +44,14 @@ export interface QaickRuntime {
   controlState(requestId: string): ExecutionControlState | undefined;
   events(requestId: string): AsyncIterable<ExecutorEvent>;
   result(requestId: string): Promise<ExecutorResult>;
-  retryAction(requestId: string, stepId: string, invocationPath?: string[]): Promise<void>;
-  retryOperation(requestId: string, stepId: string, invocationPath?: string[]): Promise<void>;
-  runFromHere(requestId: string, stepId: string, invocationPath?: string[]): Promise<ExecutorRun | undefined>;
+  retryAction(requestId: string, target: ActReplayTarget): Promise<ActReplayHandle>;
+  retryOperation(requestId: string, target: ActReplayTarget): Promise<OperationReplayHandle>;
+  runFromHere(requestId: string, target: ActReplayTarget): Promise<ExecutorRun>;
   registerActionExecutor(executor: ActionExecutor): void;
 }
 
 export function createRuntime(configuration: RuntimeConfiguration = {}): QaickRuntime {
-  return new ComposedQaickRuntime(configuration.executor ?? createMigratedExecutor(configuration));
+  return new ComposedQaickRuntime(configuration.executor ?? createExecutor(configuration));
 }
 
 class ComposedQaickRuntime implements QaickRuntime {
@@ -70,8 +73,8 @@ class ComposedQaickRuntime implements QaickRuntime {
   controlState(requestId: string): ExecutionControlState | undefined { return this.executor.controlState(requestId); }
   events(requestId: string): AsyncIterable<ExecutorEvent> { return this.executor.events(requestId); }
   result(requestId: string): Promise<ExecutorResult> { return this.executor.result(requestId); }
-  retryAction(requestId: string, stepId: string, invocationPath?: string[]): Promise<void> { return this.executor.retryAction(requestId, stepId, invocationPath); }
-  retryOperation(requestId: string, stepId: string, invocationPath?: string[]): Promise<void> { return this.executor.retryOperation(requestId, stepId, invocationPath); }
-  runFromHere(requestId: string, stepId: string, invocationPath?: string[]): Promise<ExecutorRun | undefined> { return this.executor.runFromHere(requestId, stepId, invocationPath); }
+  retryAction(requestId: string, target: ActReplayTarget): Promise<ActReplayHandle> { return this.executor.retryAction(requestId, target); }
+  retryOperation(requestId: string, target: ActReplayTarget): Promise<OperationReplayHandle> { return this.executor.retryOperation(requestId, target); }
+  runFromHere(requestId: string, target: ActReplayTarget): Promise<ExecutorRun> { return this.executor.runFromHere(requestId, target); }
   registerActionExecutor(executor: ActionExecutor): void { this.executor.registerActionExecutor(executor); }
 }


## regressions.diff

diff --git a/src/runtime-headless.test.ts b/src/runtime-headless.test.ts
index 036282b..1e51ba5 100644
--- a/src/runtime-headless.test.ts
+++ b/src/runtime-headless.test.ts
@@ -3,7 +3,7 @@ import type { ActionExecutor } from '@qaick/executor';
 import { createRuntime } from './runtime.js';
 
 const flow = {
-  schemaVersion: 6,
+  schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
   packageId: 'runtime-headless',
   target: { kind: 'flow' as const, id: 'flow', name: 'Headless Flow' },
   definitions: [
@@ -13,8 +13,8 @@ const flow = {
   ],
   requiredInputs: ['customerId'],
   steps: [
-    { id: 'first', name: 'First', action: 'headless.first', bindings: { customerId: '$inputs.customerId' }, output: { paymentId: 'PAY-1' } },
-    { id: 'second', name: 'Second', action: 'headless.second', bindings: { paymentId: '$steps.first.paymentId' }, output: { status: 'APPROVED' } },
+    { structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'first', name: 'First', action: 'headless.first', bindings: { customerId: {type:'input' as const,path:['customerId']} }, output: { paymentId: 'PAY-1' } },
+    { structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:2}]}, id: 'second', name: 'Second', action: 'headless.second', bindings: { paymentId: {type:'hierarchy-output' as const,address:{scope:'flow' as const,segments:[{kind:'step' as const,position:1}]},iterations:[],outputName:'paymentId'} }, output: { status: 'APPROVED' } },
   ],
 };
 
@@ -52,12 +52,12 @@ describe('QAick Runtime headless acceptance', () => {
       requiredInputs: ['customerId'],
       definitions: [...flow.definitions.slice(0, 1), { id: 'headless.nested', kind: 'action' as const, name: 'Nested Action' }],
       steps: [{
-        id: 'operation',
+        structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'operation',
         name: 'Nested Operation',
         kind: 'operation' as const,
         action: 'operation',
         output: {},
-        children: [{ id: 'nested', name: 'Nested Action', action: 'headless.nested', bindings: { customerId: '$inputs.customerId' }, output: { seen: 'C-1' } }],
+        children: [{ structuralAddress:{scope:'flow' as const,segments:[{kind:'step' as const,position:1},{kind:'body' as const},{kind:'step' as const,position:1}]},id: 'nested', name: 'Nested Action', action: 'headless.nested', bindings: { customerId: {type:'input' as const,path:['customerId']} }, output: { seen: 'C-1' } }],
       }],
     };
 
@@ -87,16 +87,18 @@ describe('QAick Runtime headless acceptance', () => {
       packageId: 'runtime-retry',
       requiredInputs: [],
       definitions: [...flow.definitions.slice(0, 1), { id: 'headless.retry', kind: 'action' as const, name: 'Retry' }],
-      steps: [{ ...flow.steps[0], action: 'headless.retry', bindings: undefined }],
+      steps: [{ ...flow.steps[0], action: 'headless.retry', bindings: {} }],
     };
 
     const run = await runtime.execute({ requestId: 'runtime-retry', executionPackage, inputs: {}, environment: 'node' });
     expect((await run.result).state).toBe('failed');
-    await runtime.retryAction('runtime-retry', 'first');
-    expect((await runtime.result('runtime-retry')).state).toBe('completed');
+    const target = {structuralAddress:executionPackage.steps[0].structuralAddress,iterations:[]};
+    const replay = await runtime.retryAction('runtime-retry', target);
+    expect((await replay.result).state).toBe('completed');
+    expect((await runtime.result('runtime-retry')).state).toBe('failed');
 
-    const fromHere = await runtime.runFromHere('runtime-retry', 'first');
-    expect(fromHere?.requestId).toMatch(/^runtime-retry:from:first:/);
+    const fromHere = await runtime.runFromHere('runtime-retry', target);
+    expect(fromHere.requestId).not.toBe('runtime-retry');
     expect((await fromHere!.result).state).toBe('completed');
   });
 
@@ -114,7 +116,7 @@ describe('QAick Runtime headless acceptance', () => {
       packageId: 'runtime-cancel',
       requiredInputs: [],
       definitions: [...flow.definitions.slice(0, 1), { id: 'headless.wait', kind: 'action' as const, name: 'Wait' }],
-      steps: [{ ...flow.steps[0], action: 'headless.wait', bindings: undefined }],
+      steps: [{ ...flow.steps[0], action: 'headless.wait', bindings: {} }],
     };
 
     const run = await runtime.execute({ requestId: 'runtime-cancel', executionPackage, inputs: {}, environment: 'node' });
diff --git a/src/runtime-http.test.ts b/src/runtime-http.test.ts
index 5fca61c..77f772b 100644
--- a/src/runtime-http.test.ts
+++ b/src/runtime-http.test.ts
@@ -23,7 +23,7 @@ describe('QAick Runtime Node HTTP composition', () => {
     };
     const runtime = createRuntime({ actionExecutors: [new HttpActionExecutor(transport)] });
     const executionPackage = {
-      schemaVersion: 6,
+      schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
       packageId: 'runtime-cookie-session',
       target: { kind: 'flow' as const, id: 'flow', name: 'Cookie Session' },
       definitions: [
@@ -31,8 +31,8 @@ describe('QAick Runtime Node HTTP composition', () => {
         { id: 'http.payment', kind: 'action' as const, name: 'Payment' },
       ],
       steps: [
-        { id: 'auth', name: 'Auth', action: 'http.auth', output: { cookies: null }, staticInputs: { url: 'https://example.test/auth', method: 'POST' } },
-        { id: 'payment', name: 'Payment', action: 'http.payment', output: {}, dependsOn: ['auth'], bindings: { cookies: '$steps.auth.cookies' }, staticInputs: { url: 'https://example.test/payment', method: 'POST', cookies: '{{inputs.cookies}}' } },
+        { structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'auth', name: 'Auth', action: 'http.auth', output: { cookies: null }, staticInputs: { url: 'https://example.test/auth', method: 'POST' } },
+        { structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:2}]}, id: 'payment', name: 'Payment', action: 'http.payment', output: {}, dependsOn: ['auth'], bindings: { cookies: {type:'hierarchy-output' as const,address:{scope:'flow' as const,segments:[{kind:'step' as const,position:1}]},iterations:[],outputName:'cookies'} }, staticInputs: { url: 'https://example.test/payment', method: 'POST', cookies: '{{inputs.cookies}}' } },
       ],
       requiredInputs: [],
     };
@@ -42,7 +42,7 @@ describe('QAick Runtime Node HTTP composition', () => {
 
     const { dependsOn: _dependsOn, ...paymentOnlyStep } = executionPackage.steps[1];
     const secondRun = await runtime.execute({
-      requestId: 'runtime-cookie-b', executionPackage: { ...executionPackage, steps: [paymentOnlyStep] }, inputs: {}, environment: 'test',
+      requestId: 'runtime-cookie-b', executionPackage: { ...executionPackage, steps: [paymentOnlyStep], omittedOccurrences:[{address:executionPackage.steps[0].structuralAddress,reason:'isolated diagnostic'}] }, inputs: {}, environment: 'test',
     });
     expect((await secondRun.result).state).toBe('failed');
     expect(observedCookies).toEqual([undefined, 'session=runtime-session']);
@@ -71,7 +71,7 @@ describe('QAick Runtime Node HTTP composition', () => {
       actionExecutors: [new HttpActionExecutor(new NodeHttpTransport())],
     });
     const executionPackage = {
-      schemaVersion: 6,
+      schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
       packageId: 'runtime-http-composition',
       target: { kind: 'flow' as const, id: 'flow', name: 'Runtime HTTP Flow' },
       definitions: [
@@ -80,7 +80,7 @@ describe('QAick Runtime Node HTTP composition', () => {
       ],
       requiredInputs: [],
       steps: [{
-        id: 'load-orders',
+        structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'load-orders',
         name: 'Load orders',
         action: 'http.request',
         staticInputs: { url: `http://127.0.0.1:${address.port}/orders`, method: 'GET' },
@@ -138,7 +138,7 @@ describe('QAick Runtime Node HTTP composition', () => {
     if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.');
     const runtime = createRuntime({ actionExecutors: [new HttpActionExecutor(new NodeHttpTransport())] });
     const packageFor = (path: string, staticInputs: Record<string, unknown>, adapterConfig?: Record<string, unknown>) => ({
-      schemaVersion: 6,
+      schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
       packageId: `runtime-http-${path.slice(1)}`,
       target: { kind: 'flow' as const, id: 'flow', name: 'Runtime HTTP Flow' },
       definitions: [
@@ -146,7 +146,7 @@ describe('QAick Runtime Node HTTP composition', () => {
         { id: 'http.request', kind: 'action' as const, name: 'HTTP Request' },
       ],
       requiredInputs: [],
-      steps: [{ id: 'request', name: 'Request', action: 'http.request', staticInputs, adapterConfig, output: {} }],
+      steps: [{ structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'request', name: 'Request', action: 'http.request', staticInputs, ...(adapterConfig ? {adapterConfig}:{}), output: {} }],
     });
     const baseUrl = `http://127.0.0.1:${address.port}`;
 
@@ -157,7 +157,7 @@ describe('QAick Runtime Node HTTP composition', () => {
       environment: 'node',
     });
     const postResult = await postRun.result;
-    expect(postResult.state).toBe('completed');
+    expect(postResult.state, JSON.stringify(postResult.error)).toBe('completed');
     expect(postResult.steps[0]?.outputs).toMatchObject({ body: { received: { name: 'QAick' } } });
 
     const errorRun = await runtime.execute({
diff --git a/src/runtime.test.ts b/src/runtime.test.ts
index d0c6ecb..009bad1 100644
--- a/src/runtime.test.ts
+++ b/src/runtime.test.ts
@@ -20,7 +20,7 @@ describe('QAick Runtime composition', () => {
     };
     const runtime = createRuntime({ actionExecutors: [action] });
     const executionPackage = {
-      schemaVersion: 6,
+      schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
       packageId: 'runtime-composition',
       target: { kind: 'flow' as const, id: 'flow', name: 'Runtime Flow' },
       definitions: [
@@ -28,7 +28,7 @@ describe('QAick Runtime composition', () => {
         { id: 'runtime.echo', kind: 'action' as const, name: 'Echo' },
       ],
       requiredInputs: [],
-      steps: [{ id: 'echo', name: 'Echo', action: 'runtime.echo', staticInputs: { value: 'hello' }, output: { echoed: 'value' } }],
+      steps: [{ structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'echo', name: 'Echo', action: 'runtime.echo', staticInputs: { value: 'hello' }, output: { echoed: 'value' } }],
     };
 
     const run = await runtime.execute({ requestId: 'runtime-composition', executionPackage, inputs: {}, environment: 'test' });
@@ -47,9 +47,9 @@ describe('QAick Runtime composition', () => {
     const run = await runtime.execute({
       requestId: 'runtime-execution-key',
       executionPackage: {
-        schemaVersion: 6, packageId: 'runtime-execution-key', target: { kind: 'flow', id: 'flow', name: 'Execution Key' },
+        schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const}, packageId: 'runtime-execution-key', target: { kind: 'flow', id: 'flow', name: 'Execution Key' },
         definitions: [{ id: 'runtime.execution-key', kind: 'action', name: 'Execution Key' }],
-        steps: [{ id: 'key', name: 'Execution Key', action: 'runtime.execution-key', output: {} }], requiredInputs: [],
+        steps: [{ structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'key', name: 'Execution Key', action: 'runtime.execution-key', output: {} }], requiredInputs: [],
       },
       inputs: {}, environment: 'test', runtimeValues: { environment: 'test' },
     });
@@ -64,7 +64,7 @@ describe('QAick Runtime composition', () => {
     };
     const runtime = createRuntime({ actionExecutors: [action] });
     const executionPackage = {
-      schemaVersion: 6,
+      schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
       packageId: 'runtime-controls',
       target: { kind: 'flow' as const, id: 'flow', name: 'Runtime Flow' },
       definitions: [
@@ -72,7 +72,7 @@ describe('QAick Runtime composition', () => {
         { id: 'runtime.controlled', kind: 'action' as const, name: 'Controlled' },
       ],
       requiredInputs: [],
-      steps: [{ id: 'controlled', name: 'Controlled', action: 'runtime.controlled', output: { ok: true } }],
+      steps: [{ structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'controlled', name: 'Controlled', action: 'runtime.controlled', output: { ok: true } }],
     };
     const run = await runtime.execute({ requestId: 'runtime-controls', executionPackage, inputs: {}, environment: 'test' });
     const events = [];
@@ -86,7 +86,7 @@ describe('QAick Runtime composition', () => {
   it('returns a stable terminal failure for an unsupported action', async () => {
     const runtime = createRuntime();
     const executionPackage = {
-      schemaVersion: 6,
+      schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
       packageId: 'runtime-unsupported-action',
       target: { kind: 'flow' as const, id: 'flow', name: 'Runtime Flow' },
       definitions: [
@@ -94,7 +94,7 @@ describe('QAick Runtime composition', () => {
         { id: 'missing.action', kind: 'action' as const, name: 'Missing Action' },
       ],
       requiredInputs: [],
-      steps: [{ id: 'missing', name: 'Missing', action: 'missing.action', output: {} }],
+      steps: [{ structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'missing', name: 'Missing', action: 'missing.action', output: {} }],
     };
 
     const run = await runtime.execute({ requestId: 'runtime-unsupported-action', executionPackage, inputs: {}, environment: 'test' });
@@ -102,7 +102,7 @@ describe('QAick Runtime composition', () => {
     const second = await runtime.result('runtime-unsupported-action');
 
     expect(first.state).toBe('failed');
-    expect(first.error?.code).toBe('MISSING_ACTION_ADAPTER');
+    expect(first.error?.code).toBe('UNSUPPORTED_ACTION');
     expect(second).toEqual(first);
   });
 });


## changed-source-files.txt

src/index.ts
src/runtime-headless.test.ts
src/runtime-http.test.ts
src/runtime.test.ts
src/runtime.ts


## repository-state.json

{
  "head": "13ecc2d847d9cba99ae03386ffa1aeb9013060d0",
  "sourceFiles": [
    "src/index.ts",
    "src/runtime-headless.test.ts",
    "src/runtime-http.test.ts",
    "src/runtime.test.ts",
    "src/runtime.ts"
  ],
  "manifestsOrLockfilesChanged": [],
  "statusAtCapture": " M src/index.ts\n M src/runtime-headless.test.ts\n M src/runtime-http.test.ts\n M src/runtime.test.ts\n M src/runtime.ts\n?? docs/evidence/\n"
}

import { describe, expect, it } from 'vitest';
import type { ActionExecutor } from '@qaick/executor';
import { createRuntime } from './runtime.js';
import packageJson from '../package.json' with { type: 'json' };

describe('QAick Runtime composition', () => {
  it('reports the stable host-neutral Runtime capabilities', () => {
    const runtime = createRuntime();

    expect(runtime.info?.()).toEqual({
      name: '@qaick/runtime',
      version: packageJson.version,
      capabilities: ['execution', 'controls', 'events', 'results', 'retries', 'run-from-here', 'action-executors'],
    });
  });

  it('composes Executor and routes execution through the public runtime API', async () => {
    const action: ActionExecutor = {
      supports: name => name === 'runtime.echo',
      execute: async context => ({ outputs: { echoed: context.inputs.value } }),
    };
    const runtime = createRuntime({ actionExecutors: [action] });
    const executionPackage = {
      schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
      packageId: 'runtime-composition',
      target: { kind: 'flow' as const, id: 'flow', name: 'Runtime Flow' },
      definitions: [
        { id: 'flow', kind: 'flow' as const, name: 'Runtime Flow' },
        { id: 'runtime.echo', kind: 'action' as const, name: 'Echo' },
      ],
      requiredInputs: [],
      steps: [{ structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'echo', name: 'Echo', action: 'runtime.echo', staticInputs: { value: 'hello' }, output: { echoed: 'value' } }],
    };

    const run = await runtime.execute({ requestId: 'runtime-composition', executionPackage, inputs: {}, environment: 'test' });
    const result = await run.result;

    expect(result.state).toBe('completed');
    expect(result.steps[0]?.outputs).toEqual({ echoed: 'hello' });
  });

  it('preserves caller runtime values without adding hidden session state', async () => {
    let runtimeValues: Record<string, unknown> | undefined;
    const runtime = createRuntime({ actionExecutors: [{
      supports: name => name === 'runtime.execution-key',
      execute: context => { runtimeValues = context.runtimeValues; return { outputs: { ok: true } }; },
    }] });
    const run = await runtime.execute({
      requestId: 'runtime-execution-key',
      executionPackage: {
        schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const}, packageId: 'runtime-execution-key', target: { kind: 'flow', id: 'flow', name: 'Execution Key' },
        definitions: [{ id: 'runtime.execution-key', kind: 'action', name: 'Execution Key' }],
        steps: [{ structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'key', name: 'Execution Key', action: 'runtime.execution-key', output: {} }], requiredInputs: [],
      },
      inputs: {}, environment: 'test', runtimeValues: { environment: 'test' },
    });
    await run.result;
    expect(runtimeValues).toEqual({ environment: 'test' });
  });

  it('routes controls and events without exposing a host transport', async () => {
    const action: ActionExecutor = {
      supports: name => name === 'runtime.controlled',
      execute: async () => ({ outputs: { ok: true } }),
    };
    const runtime = createRuntime({ actionExecutors: [action] });
    const executionPackage = {
      schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
      packageId: 'runtime-controls',
      target: { kind: 'flow' as const, id: 'flow', name: 'Runtime Flow' },
      definitions: [
        { id: 'flow', kind: 'flow' as const, name: 'Runtime Flow' },
        { id: 'runtime.controlled', kind: 'action' as const, name: 'Controlled' },
      ],
      requiredInputs: [],
      steps: [{ structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'controlled', name: 'Controlled', action: 'runtime.controlled', output: { ok: true } }],
    };
    const run = await runtime.execute({ requestId: 'runtime-controls', executionPackage, inputs: {}, environment: 'test' });
    const events = [];
    for await (const event of runtime.events('runtime-controls')) events.push(event);
    await run.result;

    expect(events.at(-1)?.type).toBe('run_finished');
    expect(runtime.controlState('runtime-controls')).toBe('completed');
  });

  it('returns a stable terminal failure for an unsupported action', async () => {
    const runtime = createRuntime();
    const executionPackage = {
      schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
      packageId: 'runtime-unsupported-action',
      target: { kind: 'flow' as const, id: 'flow', name: 'Runtime Flow' },
      definitions: [
        { id: 'flow', kind: 'flow' as const, name: 'Runtime Flow' },
        { id: 'missing.action', kind: 'action' as const, name: 'Missing Action' },
      ],
      requiredInputs: [],
      steps: [{ structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'missing', name: 'Missing', action: 'missing.action', output: {} }],
    };

    const run = await runtime.execute({ requestId: 'runtime-unsupported-action', executionPackage, inputs: {}, environment: 'test' });
    const first = await run.result;
    const second = await runtime.result('runtime-unsupported-action');

    expect(first.state).toBe('failed');
    expect(first.error?.code).toBe('UNSUPPORTED_ACTION');
    expect(second).toEqual(first);
  });
});

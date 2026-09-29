import { describe, expect, it } from 'vitest';
import type { ActionExecutor } from '@qaick/executor';
import { createRuntime } from './runtime.js';

describe('QAick Runtime composition', () => {
  it('reports the stable host-neutral Runtime capabilities', () => {
    const runtime = createRuntime();

    expect(runtime.info?.()).toEqual({
      name: '@qaick/runtime',
      version: '0.1.0-alpha.2',
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
      schemaVersion: 6,
      packageId: 'runtime-composition',
      target: { kind: 'flow' as const, id: 'flow', name: 'Runtime Flow' },
      definitions: [
        { id: 'flow', kind: 'flow' as const, name: 'Runtime Flow' },
        { id: 'runtime.echo', kind: 'action' as const, name: 'Echo' },
      ],
      requiredInputs: [],
      steps: [{ id: 'echo', name: 'Echo', action: 'runtime.echo', staticInputs: { value: 'hello' }, output: { echoed: 'value' } }],
    };

    const run = await runtime.execute({ requestId: 'runtime-composition', executionPackage, inputs: {}, environment: 'test' });
    const result = await run.result;

    expect(result.state).toBe('completed');
    expect(result.steps[0]?.outputs).toEqual({ echoed: 'hello' });
  });

  it('routes controls and events without exposing a host transport', async () => {
    const action: ActionExecutor = {
      supports: name => name === 'runtime.controlled',
      execute: async () => ({ outputs: { ok: true } }),
    };
    const runtime = createRuntime({ actionExecutors: [action] });
    const executionPackage = {
      schemaVersion: 6,
      packageId: 'runtime-controls',
      target: { kind: 'flow' as const, id: 'flow', name: 'Runtime Flow' },
      definitions: [
        { id: 'flow', kind: 'flow' as const, name: 'Runtime Flow' },
        { id: 'runtime.controlled', kind: 'action' as const, name: 'Controlled' },
      ],
      requiredInputs: [],
      steps: [{ id: 'controlled', name: 'Controlled', action: 'runtime.controlled', output: { ok: true } }],
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
      schemaVersion: 6,
      packageId: 'runtime-unsupported-action',
      target: { kind: 'flow' as const, id: 'flow', name: 'Runtime Flow' },
      definitions: [
        { id: 'flow', kind: 'flow' as const, name: 'Runtime Flow' },
        { id: 'missing.action', kind: 'action' as const, name: 'Missing Action' },
      ],
      requiredInputs: [],
      steps: [{ id: 'missing', name: 'Missing', action: 'missing.action', output: {} }],
    };

    const run = await runtime.execute({ requestId: 'runtime-unsupported-action', executionPackage, inputs: {}, environment: 'test' });
    const first = await run.result;
    const second = await runtime.result('runtime-unsupported-action');

    expect(first.state).toBe('failed');
    expect(first.error?.code).toBe('MISSING_ACTION_ADAPTER');
    expect(second).toEqual(first);
  });
});

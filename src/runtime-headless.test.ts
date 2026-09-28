import { describe, expect, it } from 'vitest';
import type { ActionExecutor } from '@qaick/executor';
import { createRuntime } from './runtime.js';

const flow = {
  schemaVersion: 6,
  packageId: 'runtime-headless',
  target: { kind: 'flow' as const, id: 'flow', name: 'Headless Flow' },
  definitions: [
    { id: 'flow', kind: 'flow' as const, name: 'Headless Flow' },
    { id: 'headless.first', kind: 'action' as const, name: 'First' },
    { id: 'headless.second', kind: 'action' as const, name: 'Second' },
  ],
  requiredInputs: ['customerId'],
  steps: [
    { id: 'first', name: 'First', action: 'headless.first', bindings: { customerId: '$inputs.customerId' }, output: { paymentId: 'PAY-1' } },
    { id: 'second', name: 'Second', action: 'headless.second', bindings: { paymentId: '$steps.first.paymentId' }, output: { status: 'APPROVED' } },
  ],
};

describe('QAick Runtime headless acceptance', () => {
  it('resolves inputs and step bindings with ordered terminal events', async () => {
    const action: ActionExecutor = {
      supports: name => name.startsWith('headless.'),
      execute: async context => context.action === 'headless.first'
        ? { outputs: { paymentId: 'PAY-1' } }
        : { outputs: { status: context.inputs.paymentId === 'PAY-1' ? 'APPROVED' : 'INVALID' } },
    };
    const runtime = createRuntime({ actionExecutors: [action] });

    const run = await runtime.execute({ requestId: 'runtime-bindings', executionPackage: flow, inputs: { customerId: 'C-1' }, environment: 'node' });
    const result = await run.result;
    const events = [];
    for await (const event of runtime.events('runtime-bindings')) events.push(event);

    expect(result.state).toBe('completed');
    expect(result.steps[1]?.inputs).toEqual({ paymentId: 'PAY-1' });
    expect(result.steps[1]?.outputs).toEqual({ status: 'APPROVED' });
    expect(events.at(-1)?.type).toBe('run_finished');
    expect(events.map(event => event.sequence)).toEqual(events.map((_event, index) => index + 1));
  });

  it('executes nested Operation children through the shared Executor boundary', async () => {
    const action: ActionExecutor = {
      supports: name => name === 'headless.nested',
      execute: async context => ({ outputs: { seen: context.inputs.customerId } }),
    };
    const runtime = createRuntime({ actionExecutors: [action] });
    const executionPackage = {
      ...flow,
      packageId: 'runtime-nested-operation',
      requiredInputs: ['customerId'],
      definitions: [...flow.definitions.slice(0, 1), { id: 'headless.nested', kind: 'action' as const, name: 'Nested Action' }],
      steps: [{
        id: 'operation',
        name: 'Nested Operation',
        kind: 'operation' as const,
        action: 'operation',
        output: {},
        children: [{ id: 'nested', name: 'Nested Action', action: 'headless.nested', bindings: { customerId: '$inputs.customerId' }, output: { seen: 'C-1' } }],
      }],
    };

    const run = await runtime.execute({ requestId: 'runtime-nested-operation', executionPackage, inputs: { customerId: 'C-1' }, environment: 'node' });
    const result = await run.result;

    expect(result.state).toBe('completed');
    expect(result.steps[0]?.id).toBe('operation');
    expect(result.steps[0]?.children?.[0]?.id).toBe('nested');
    expect(result.steps[0]?.children?.[0]?.inputs).toEqual({ customerId: 'C-1' });
    expect(result.steps[0]?.children?.[0]?.outputs).toEqual({ seen: 'C-1' });
  });

  it('routes interactive retry and Run From Here through the Runtime boundary', async () => {
    let calls = 0;
    const action: ActionExecutor = {
      supports: name => name === 'headless.retry',
      execute: async context => {
        calls += 1;
        if (calls === 1) throw { code: 'TEMPORARY', message: 'failed once' };
        return { outputs: context.step.output };
      },
    };
    const runtime = createRuntime({ actionExecutors: [action] });
    const executionPackage = {
      ...flow,
      packageId: 'runtime-retry',
      requiredInputs: [],
      definitions: [...flow.definitions.slice(0, 1), { id: 'headless.retry', kind: 'action' as const, name: 'Retry' }],
      steps: [{ ...flow.steps[0], action: 'headless.retry', bindings: undefined }],
    };

    const run = await runtime.execute({ requestId: 'runtime-retry', executionPackage, inputs: {}, environment: 'node' });
    expect((await run.result).state).toBe('failed');
    await runtime.retryAction('runtime-retry', 'first');
    expect((await runtime.result('runtime-retry')).state).toBe('completed');

    const fromHere = await runtime.runFromHere('runtime-retry', 'first');
    expect(fromHere?.requestId).toMatch(/^runtime-retry:from:first:/);
    expect((await fromHere!.result).state).toBe('completed');
  });

  it('cancels a headless run through the Runtime boundary', async () => {
    const runtime = createRuntime({
      actionExecutors: [{
        supports: name => name === 'headless.wait',
        execute: ({ signal }) => new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
      }],
    });
    const executionPackage = {
      ...flow,
      packageId: 'runtime-cancel',
      requiredInputs: [],
      definitions: [...flow.definitions.slice(0, 1), { id: 'headless.wait', kind: 'action' as const, name: 'Wait' }],
      steps: [{ ...flow.steps[0], action: 'headless.wait', bindings: undefined }],
    };

    const run = await runtime.execute({ requestId: 'runtime-cancel', executionPackage, inputs: {}, environment: 'node' });
    await runtime.cancel('runtime-cancel');

    expect((await run.result).state).toBe('cancelled');
  });
});

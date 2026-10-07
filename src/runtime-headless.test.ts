import { describe, expect, it } from 'vitest';
import type { ActionExecutor } from '@qaick/executor';
import { createRuntime } from './runtime.js';

const flow = {
  schemaVersion: 7 as const, ordering: 'routine' as const, executionContext: {scope:'flow' as const,mode:'standalone' as const},
  packageId: 'runtime-headless',
  target: { kind: 'flow' as const, id: 'flow', name: 'Headless Flow' },
  definitions: [
    { id: 'flow', kind: 'flow' as const, name: 'Headless Flow' },
    { id: 'headless.first', kind: 'action' as const, name: 'First' },
    { id: 'headless.second', kind: 'action' as const, name: 'Second' },
  ],
  requiredInputs: ['customerId'],
  steps: [
    { structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'first', name: 'First', action: 'headless.first', bindings: { customerId: {type:'input' as const,path:['customerId']} }, output: { paymentId: 'PAY-1' } },
    { structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:2}]}, id: 'second', name: 'Second', action: 'headless.second', bindings: { paymentId: {type:'hierarchy-output' as const,address:{scope:'flow' as const,segments:[{kind:'step' as const,position:1}]},iterations:[],outputName:'paymentId'} }, output: { status: 'APPROVED' } },
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
        structuralAddress: {scope:'flow' as const,segments:[{kind:'step' as const,position:1}]}, id: 'operation',
        name: 'Nested Operation',
        kind: 'operation' as const,
        action: 'operation',
        output: {},
        children: [{ structuralAddress:{scope:'flow' as const,segments:[{kind:'step' as const,position:1},{kind:'body' as const},{kind:'step' as const,position:1}]},id: 'nested', name: 'Nested Action', action: 'headless.nested', bindings: { customerId: {type:'input' as const,path:['customerId']} }, output: { seen: 'C-1' } }],
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
      steps: [{ ...flow.steps[0], action: 'headless.retry', bindings: {} }],
    };

    const run = await runtime.execute({ requestId: 'runtime-retry', executionPackage, inputs: {}, environment: 'node' });
    expect((await run.result).state).toBe('failed');
    const target = {structuralAddress:executionPackage.steps[0].structuralAddress,iterations:[]};
    const replay = await runtime.retryAction('runtime-retry', target);
    expect((await replay.result).state).toBe('completed');
    expect((await runtime.result('runtime-retry')).state).toBe('failed');

    const fromHere = await runtime.runFromHere('runtime-retry', target);
    expect(fromHere.requestId).not.toBe('runtime-retry');
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
      steps: [{ ...flow.steps[0], action: 'headless.wait', bindings: {} }],
    };

    const run = await runtime.execute({ requestId: 'runtime-cancel', executionPackage, inputs: {}, environment: 'node' });
    await runtime.cancel('runtime-cancel');

    expect((await run.result).state).toBe('cancelled');
  });
});

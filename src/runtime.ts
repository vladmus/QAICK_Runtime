import { createExecutor } from '@qaick/executor';
import { ScriptActionExecutor, type ScriptBackend } from './script.js';
import packageJson from '../package.json' with { type: 'json' };
import type {
  ActionExecutor,
  ControlCommand,
  ExecutionControlState,
  Executor,
  ExecutorConfiguration,
  ExecutorEvent,
  ExecutorRequest,
  ExecutorResult,
  ExecutorRun,
  ActReplayTarget,
  ActReplayHandle,
  OperationReplayHandle,
} from '@qaick/executor';

export interface RuntimeConfiguration extends ExecutorConfiguration {
  executor?: Executor;
  scriptBackend?: ScriptBackend;
}

export const RUNTIME_VERSION = packageJson.version;

export type RuntimeCapability =
  | 'execution'
  | 'controls'
  | 'events'
  | 'results'
  | 'retries'
  | 'run-from-here'
  | 'action-executors';

export interface RuntimeInfo {
  name: '@qaick/runtime';
  version: typeof RUNTIME_VERSION;
  capabilities: readonly RuntimeCapability[];
}

export interface QaickRuntime {
  /** Optional for compatibility with Executor implementations used as local adapters. */
  info?(): RuntimeInfo;
  execute(request: ExecutorRequest): Promise<ExecutorRun>;
  cancel(requestId: string): Promise<void>;
  control(requestId: string, command: ControlCommand): Promise<void>;
  controlState(requestId: string): ExecutionControlState | undefined;
  events(requestId: string): AsyncIterable<ExecutorEvent>;
  result(requestId: string): Promise<ExecutorResult>;
  retryAction(requestId: string, target: ActReplayTarget): Promise<ActReplayHandle>;
  retryOperation(requestId: string, target: ActReplayTarget): Promise<OperationReplayHandle>;
  runFromHere(requestId: string, target: ActReplayTarget): Promise<ExecutorRun>;
  registerActionExecutor(executor: ActionExecutor): void;
}

export function createRuntime(configuration: RuntimeConfiguration = {}): QaickRuntime {
  const executor = configuration.executor ?? createExecutor(configuration);
  executor.registerActionExecutor(new ScriptActionExecutor(configuration.scriptBackend));
  return new ComposedQaickRuntime(executor);
}

class ComposedQaickRuntime implements QaickRuntime {
  constructor(private readonly executor: Executor) {}

  info(): RuntimeInfo {
    return {
      name: '@qaick/runtime',
      version: RUNTIME_VERSION,
      capabilities: ['execution', 'controls', 'events', 'results', 'retries', 'run-from-here', 'action-executors'],
    };
  }

  execute(request: ExecutorRequest): Promise<ExecutorRun> {
    return this.executor.execute(request);
  }
  cancel(requestId: string): Promise<void> { return this.executor.cancel(requestId); }
  control(requestId: string, command: ControlCommand): Promise<void> { return this.executor.control(requestId, command); }
  controlState(requestId: string): ExecutionControlState | undefined { return this.executor.controlState(requestId); }
  events(requestId: string): AsyncIterable<ExecutorEvent> { return this.executor.events(requestId); }
  result(requestId: string): Promise<ExecutorResult> { return this.executor.result(requestId); }
  retryAction(requestId: string, target: ActReplayTarget): Promise<ActReplayHandle> { return this.executor.retryAction(requestId, target); }
  retryOperation(requestId: string, target: ActReplayTarget): Promise<OperationReplayHandle> { return this.executor.retryOperation(requestId, target); }
  runFromHere(requestId: string, target: ActReplayTarget): Promise<ExecutorRun> { return this.executor.runFromHere(requestId, target); }
  registerActionExecutor(executor: ActionExecutor): void { this.executor.registerActionExecutor(executor); }
}

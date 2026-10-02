import { createMigratedExecutor } from '@qaick/executor';
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
} from '@qaick/executor';

export interface RuntimeConfiguration extends ExecutorConfiguration {
  executor?: Executor;
}

export const RUNTIME_VERSION = '0.1.0-alpha.7' as const;

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
  retryAction(requestId: string, stepId: string, invocationPath?: string[]): Promise<void>;
  retryOperation(requestId: string, stepId: string, invocationPath?: string[]): Promise<void>;
  runFromHere(requestId: string, stepId: string, invocationPath?: string[]): Promise<ExecutorRun | undefined>;
  registerActionExecutor(executor: ActionExecutor): void;
}

export function createRuntime(configuration: RuntimeConfiguration = {}): QaickRuntime {
  return new ComposedQaickRuntime(configuration.executor ?? createMigratedExecutor(configuration));
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
  retryAction(requestId: string, stepId: string, invocationPath?: string[]): Promise<void> { return this.executor.retryAction(requestId, stepId, invocationPath); }
  retryOperation(requestId: string, stepId: string, invocationPath?: string[]): Promise<void> { return this.executor.retryOperation(requestId, stepId, invocationPath); }
  runFromHere(requestId: string, stepId: string, invocationPath?: string[]): Promise<ExecutorRun | undefined> { return this.executor.runFromHere(requestId, stepId, invocationPath); }
  registerActionExecutor(executor: ActionExecutor): void { this.executor.registerActionExecutor(executor); }
}

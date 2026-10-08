import type { ActionExecutor, ActionExecutionContext } from '@qaick/executor';

export const SCRIPT_TIMEOUT_MS = 1_000;
export const MAX_SCRIPT_SOURCE_LENGTH = 20_000;
export const MAX_SCRIPT_JSON_SIZE = 100_000;
export interface ScriptJob { source: string; inputs: Record<string, unknown>; outputNames: string[] }
export type ScriptBackend = (job: ScriptJob, signal: AbortSignal) => Promise<unknown>;

/** Also runs inside the Worker, before structured cloning can erase invalid values. */
export function scriptJsonIssue(value: unknown, depth = 0, seen = new Set<object>()): string | undefined {
  if (depth > 10) return 'JSON nesting exceeds 10 levels.';
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') return Number.isFinite(value) ? undefined : 'Non-finite numbers are not JSON.';
  if (typeof value !== 'object') return 'Value is not JSON-compatible.';
  if (seen.has(value)) return 'Cyclic values are not JSON.';
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return 'Only plain JSON objects are supported.';
  if (Object.getOwnPropertySymbols(value).length) return 'Symbol properties are not JSON.';
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(d => d.get || d.set)) return 'Accessors are not JSON values.';
  const keys = Object.keys(value);
  if (keys.length > 1_000 || (Array.isArray(value) && value.length > 1_000)) return 'JSON collection exceeds 1000 items.';
  if (Array.isArray(value) && keys.length !== value.length) return 'Sparse or extended arrays are not JSON.';
  seen.add(value);
  for (const key of keys) {
    const issue = scriptJsonIssue((value as Record<string, unknown>)[key], depth + 1, seen);
    if (issue) return issue;
  }
  seen.delete(value);
}
export function scriptResultIssue(value: unknown, outputNames: readonly string[]): string | undefined {
  const issue = scriptJsonIssue(value);
  if (issue) return issue;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Script must return an object of named results.';
  if (JSON.stringify(value).length > MAX_SCRIPT_JSON_SIZE) return 'Script result exceeds 100000 characters.';
  const missing = outputNames.filter(name => !Object.hasOwn(value, name));
  return missing.length ? `Missing declared script outputs: ${missing.join(', ')}.` : undefined;
}
function failure(code: string, message: string): {code: string; message: string} { return {code, message}; }
// Self-contained literal: bundlers cannot rename identifiers inside this program.
export const SCRIPT_WORKER_SOURCE = "const MAX_SCRIPT_JSON_SIZE = 100000;\nfunction scriptJsonIssue(value, depth = 0, seen = new Set()) {\n    if (depth > 10)\n        return 'JSON nesting exceeds 10 levels.';\n    if (value === null || typeof value === 'string' || typeof value === 'boolean')\n        return;\n    if (typeof value === 'number')\n        return Number.isFinite(value) ? undefined : 'Non-finite numbers are not JSON.';\n    if (typeof value !== 'object')\n        return 'Value is not JSON-compatible.';\n    if (seen.has(value))\n        return 'Cyclic values are not JSON.';\n    const prototype = Object.getPrototypeOf(value);\n    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)\n        return 'Only plain JSON objects are supported.';\n    if (Object.getOwnPropertySymbols(value).length)\n        return 'Symbol properties are not JSON.';\n    const descriptors = Object.getOwnPropertyDescriptors(value);\n    if (Object.values(descriptors).some(d => d.get || d.set))\n        return 'Accessors are not JSON values.';\n    const keys = Object.keys(value);\n    if (keys.length > 1_000 || (Array.isArray(value) && value.length > 1_000))\n        return 'JSON collection exceeds 1000 items.';\n    if (Array.isArray(value) && keys.length !== value.length)\n        return 'Sparse or extended arrays are not JSON.';\n    seen.add(value);\n    for (const key of keys) {\n        const issue = scriptJsonIssue(value[key], depth + 1, seen);\n        if (issue)\n            return issue;\n    }\n    seen.delete(value);\n}\nfunction scriptResultIssue(value, outputNames) {\n    const issue = scriptJsonIssue(value);\n    if (issue)\n        return issue;\n    if (!value || typeof value !== 'object' || Array.isArray(value))\n        return 'Script must return an object of named results.';\n    if (JSON.stringify(value).length > MAX_SCRIPT_JSON_SIZE)\n        return 'Script result exceeds 100000 characters.';\n    const missing = outputNames.filter(name => !Object.hasOwn(value, name));\n    return missing.length ? `Missing declared script outputs: ${missing.join(', ')}.` : undefined;\n}\nfunction freezeArguments(value) {\n  if (value && typeof value === 'object') {\n    for (const child of Object.values(value)) freezeArguments(child);\n    Object.freeze(value);\n  }\n  return value;\n}\nself.onmessage = event => {\n  try {\n    const {source, inputs, outputNames} = event.data;\n    const run = new Function(source + \"\\nreturn run;\")();\n    if (typeof run !== 'function') throw new Error('Script must define function run(args).');\n    const result = run(freezeArguments(inputs));\n    const issue = scriptResultIssue(result, outputNames);\n    if (issue) throw {code:'SCRIPT_INVALID_OUTPUT', message:issue};\n    self.postMessage({ok:true, result});\n  } catch (error) { self.postMessage({ok:false, error:String(error?.message || error), code:error?.code || 'SCRIPT_FAILED'}); }\n};";

/** Web Workers isolate termination; this is not a security sandbox. */
export const executeWebWorkerScript: ScriptBackend = (job, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(failure('ACTION_CANCELLED', 'Script cancelled.')); return; }
  if (typeof Worker === 'undefined') { reject(failure('UNSUPPORTED_SCRIPT_EXECUTION', 'Web Worker backend unavailable.')); return; }
  let worker: Worker | undefined;
  let url: string | undefined;
  let settled = false;
  const finish = (error?: unknown, value?: unknown) => {
    if (settled) return;
    settled = true;
    signal.removeEventListener('abort', abort);
    worker?.terminate();
    if (url) URL.revokeObjectURL(url);
    if (error) reject(error); else resolve(value);
  };
  const abort = () => finish(failure('ACTION_CANCELLED', 'Script cancelled.'));
  signal.addEventListener('abort', abort, {once:true});
  try {
    url = URL.createObjectURL(new Blob([SCRIPT_WORKER_SOURCE], {type:'text/javascript'}));
    worker = new Worker(url);
    worker.onmessage = event => event.data?.ok ? finish(undefined, event.data.result) : finish(failure(event.data?.code || 'SCRIPT_FAILED', event.data?.error || 'Script failed.'));
    worker.onerror = event => finish(failure('SCRIPT_FAILED', event.message || 'Script worker failed.'));
    worker.postMessage(job);
  } catch (error) { finish(error); }
});

export class ScriptActionExecutor implements ActionExecutor {
  constructor(private readonly backend?: ScriptBackend) {}
  supports(action: string): boolean { return action.startsWith('script.'); }
  execute(context: ActionExecutionContext): Promise<{outputs: Record<string, unknown>}> {
    // Deadline includes validation, backend startup, dispatch and result validation.
    const accepted = Date.now();
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      let settled = false;
      const finish = (error?: unknown, value?: Record<string, unknown>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        context.signal.removeEventListener('abort', abort);
        controller.abort();
        if (error) reject(error); else resolve({outputs:value!});
      };
      const abort = () => finish(failure('ACTION_CANCELLED', 'Script cancelled by execution session.'));
      const timer = setTimeout(() => finish(failure('SCRIPT_TIMEOUT', 'Script exceeded 1000 ms execution limit.')), SCRIPT_TIMEOUT_MS);
      context.signal.addEventListener('abort', abort, {once:true});
      if (context.signal.aborted) { abort(); return; }
      const config = context.step.adapterConfig;
      const source = config?.source;
      const names = config?.outputNames;
      if (typeof source !== 'string' || source.length > MAX_SCRIPT_SOURCE_LENGTH || !/\bfunction\s+run\s*\(/.test(source) || !Array.isArray(names) || !names.every(name => typeof name === 'string')) {
        finish(failure('SCRIPT_INVALID_SOURCE', 'Script must define run(args), declare output names, and be at most 20000 characters.')); return;
      }
      const issue = scriptJsonIssue(context.inputs);
      if (issue) { finish(failure('SCRIPT_INVALID_INPUT', issue)); return; }
      if (!this.backend) { finish(failure('UNSUPPORTED_SCRIPT_EXECUTION', 'No script execution backend registered.')); return; }
      const job = {source, outputNames:[...names], inputs:structuredClone(context.inputs)};
      Promise.resolve().then(() => this.backend!(job, controller.signal)).then(value => {
        if (settled) return;
        const issue = scriptResultIssue(value, job.outputNames);
        if (context.signal.aborted) { abort(); return; }
        if (Date.now() - accepted >= SCRIPT_TIMEOUT_MS) { finish(failure('SCRIPT_TIMEOUT', 'Script exceeded 1000 ms execution limit.')); return; }
        if (issue) finish(failure('SCRIPT_INVALID_OUTPUT', issue));
        else finish(undefined, structuredClone(value) as Record<string, unknown>);
      }, error => finish(failure(typeof error?.code === 'string' ? error.code : 'SCRIPT_FAILED', typeof error?.message === 'string' ? error.message : String(error))));
    });
  }
}

# QAick Runtime

`@qaick/runtime` is the host-neutral composition layer for QAick execution. It configures `@qaick/executor`, registers host-provided Action Executors, and routes execution handles, controls, events, results, retries, and Run From Here operations.

Host transports and framework APIs remain outside this package. The current local development dependency points to the sibling `QAICK_Executor` repository.

```ts
import { createRuntime } from '@qaick/runtime';

const runtime = createRuntime({ actionExecutors: [actionExecutor] });
const run = await runtime.execute(request);
const result = await run.result;
```

The package requires Node 20 or newer and includes `@qaick/executor` as its execution dependency. Hosts may inject a compatible Executor implementation through `createRuntime({ executor })`.

For local development, run `npm run typecheck`, `npm test`, and `npm run build`. Use `npm pack --dry-run` to inspect the publication contents.

# QAick Runtime

`@qaick/runtime` is the host-neutral composition layer for QAick execution. It configures `@qaick/executor`, registers host-provided Action Executors, and routes execution handles, controls, events, results, retries, and Run From Here operations.

Host transports and framework APIs remain outside this package. The current package manifest depends on the published `@qaick/executor` version **0.4.13**; do not assume a sibling repository link or substitute local source when verifying an installed release.

```ts
import { createRuntime } from '@qaick/runtime';

const runtime = createRuntime({ actionExecutors: [actionExecutor] });
const run = await runtime.execute(request);
const result = await run.result;
```

The package requires Node 20 or newer and includes `@qaick/executor` as its execution dependency. Hosts may inject a compatible Executor implementation through `createRuntime({ executor })`.

For local development, run `npm run typecheck`, `npm test`, and `npm run build`. Use `npm pack --dry-run` to inspect the publication contents.

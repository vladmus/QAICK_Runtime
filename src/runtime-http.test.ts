import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { HttpActionExecutor } from '@qaick/http-executor';
import { NodeHttpTransport } from '@qaick/http-executor/node';
import { createRuntime } from './runtime.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe('QAick Runtime Node HTTP composition', () => {
  it('requires an explicit response cookie binding', async () => {
    const observedCookies: Array<string | undefined> = [];
    const transport = {
      request: async (url: string, init: { headers?: Record<string, string> }) => {
        observedCookies.push(init.headers?.Cookie ?? init.headers?.cookie);
        if (url.endsWith('/auth')) return { status: 200, body: { authenticated: true }, headers: { 'set-cookie': 'session=runtime-session; Path=/' } };
        if (init.headers?.Cookie?.includes('session=runtime-session') || init.headers?.cookie?.includes('session=runtime-session')) return { status: 200, body: { created: true }, headers: {} };
        return { status: 403, body: { error: 'missing session' }, headers: {} };
      },
    };
    const runtime = createRuntime({ actionExecutors: [new HttpActionExecutor(transport)] });
    const executionPackage = {
      schemaVersion: 6,
      packageId: 'runtime-cookie-session',
      target: { kind: 'flow' as const, id: 'flow', name: 'Cookie Session' },
      definitions: [
        { id: 'http.auth', kind: 'action' as const, name: 'Auth' },
        { id: 'http.payment', kind: 'action' as const, name: 'Payment' },
      ],
      steps: [
        { id: 'auth', name: 'Auth', action: 'http.auth', output: { cookies: null }, staticInputs: { url: 'https://example.test/auth', method: 'POST' } },
        { id: 'payment', name: 'Payment', action: 'http.payment', output: {}, dependsOn: ['auth'], bindings: { cookies: '$steps.auth.cookies' }, staticInputs: { url: 'https://example.test/payment', method: 'POST', cookies: '{{inputs.cookies}}' } },
      ],
      requiredInputs: [],
    };

    const firstRun = await runtime.execute({ requestId: 'runtime-cookie-a', executionPackage, inputs: {}, environment: 'test' });
    expect((await firstRun.result).state).toBe('completed');

    const { dependsOn: _dependsOn, ...paymentOnlyStep } = executionPackage.steps[1];
    const secondRun = await runtime.execute({
      requestId: 'runtime-cookie-b', executionPackage: { ...executionPackage, steps: [paymentOnlyStep] }, inputs: {}, environment: 'test',
    });
    expect((await secondRun.result).state).toBe('failed');
    expect(observedCookies).toEqual([undefined, 'session=runtime-session']);
  });

  it('routes a localhost request through Runtime, Executor and NodeHttpTransport', async () => {
    const server = createServer((request, response) => {
      if (request.url === '/orders') {
        response.setHeader('content-type', 'application/json');
        response.setHeader('x-auth-token', 'node-token');
        response.end(JSON.stringify({ orders: [{ id: 'order-1' }] }));
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ message: 'not found' }));
    });
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.');

    const runtime = createRuntime({
      actionExecutors: [new HttpActionExecutor(new NodeHttpTransport())],
    });
    const executionPackage = {
      schemaVersion: 6,
      packageId: 'runtime-http-composition',
      target: { kind: 'flow' as const, id: 'flow', name: 'Runtime HTTP Flow' },
      definitions: [
        { id: 'flow', kind: 'flow' as const, name: 'Runtime HTTP Flow' },
        { id: 'http.request', kind: 'action' as const, name: 'HTTP Request' },
      ],
      requiredInputs: [],
      steps: [{
        id: 'load-orders',
        name: 'Load orders',
        action: 'http.request',
        staticInputs: { url: `http://127.0.0.1:${address.port}/orders`, method: 'GET' },
        adapterConfig: { responseFields: { firstOrderId: '$.orders[0].id' } },
        output: { body: 'body', firstOrderId: 'firstOrderId', headers: 'headers' },
      }],
    };

    const run = await runtime.execute({
      requestId: 'runtime-http-composition',
      executionPackage,
      inputs: {},
      environment: 'node',
    });
    const result = await run.result;

    expect(result.state).toBe('completed');
    expect(result.steps[0]?.outputs).toMatchObject({
      body: { orders: [{ id: 'order-1' }] },
      firstOrderId: 'order-1',
      headers: { 'x-auth-token': 'node-token' },
    });
  });

  it('preserves POST JSON and HTTP failure semantics through Runtime', async () => {
    const server = createServer((request, response) => {
      if (request.url === '/echo') {
        const chunks: Buffer[] = [];
        request.on('data', chunk => chunks.push(Buffer.from(chunk)));
        request.on('end', () => {
          response.setHeader('content-type', 'application/json');
          response.end(JSON.stringify({ received: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
        });
        return;
      }
      if (request.url === '/error') {
        response.statusCode = 503;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ message: 'unavailable' }));
        return;
      }
      if (request.url === '/slow') {
        setTimeout(() => response.end('late'), 100);
        return;
      }
      response.statusCode = 404;
      response.end();
    });
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port.');
    const runtime = createRuntime({ actionExecutors: [new HttpActionExecutor(new NodeHttpTransport())] });
    const packageFor = (path: string, staticInputs: Record<string, unknown>, adapterConfig?: Record<string, unknown>) => ({
      schemaVersion: 6,
      packageId: `runtime-http-${path.slice(1)}`,
      target: { kind: 'flow' as const, id: 'flow', name: 'Runtime HTTP Flow' },
      definitions: [
        { id: 'flow', kind: 'flow' as const, name: 'Runtime HTTP Flow' },
        { id: 'http.request', kind: 'action' as const, name: 'HTTP Request' },
      ],
      requiredInputs: [],
      steps: [{ id: 'request', name: 'Request', action: 'http.request', staticInputs, adapterConfig, output: {} }],
    });
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const postRun = await runtime.execute({
      requestId: 'runtime-http-post',
      executionPackage: packageFor('/echo', { url: `${baseUrl}/echo`, method: 'POST', body: { name: 'QAick' } }),
      inputs: {},
      environment: 'node',
    });
    const postResult = await postRun.result;
    expect(postResult.state).toBe('completed');
    expect(postResult.steps[0]?.outputs).toMatchObject({ body: { received: { name: 'QAick' } } });

    const errorRun = await runtime.execute({
      requestId: 'runtime-http-error',
      executionPackage: packageFor('/error', { url: `${baseUrl}/error` }),
      inputs: {},
      environment: 'node',
    });
    const errorResult = await errorRun.result;
    expect(errorResult.state).toBe('failed');
    expect(errorResult.error?.code).toBe('HTTP_STATUS_ERROR');

    const timeoutRun = await runtime.execute({
      requestId: 'runtime-http-timeout',
      executionPackage: packageFor('/slow', { url: `${baseUrl}/slow` }, { timeoutMs: 10 }),
      inputs: {},
      environment: 'node',
    });
    const timeoutResult = await timeoutRun.result;
    expect(timeoutResult.state).toBe('failed');
    expect(timeoutResult.error?.code).toBe('HTTP_TIMEOUT');

    const networkRun = await runtime.execute({
      requestId: 'runtime-http-network',
      executionPackage: packageFor('/closed', { url: 'http://127.0.0.1:1/closed' }),
      inputs: {},
      environment: 'node',
    });
    const networkResult = await networkRun.result;
    expect(networkResult.state).toBe('failed');
    expect(networkResult.error?.code).toBe('HTTP_NETWORK_ERROR');
  });
});

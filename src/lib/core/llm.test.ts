/**
 * Tests for the OpenAI-compatible LLM client.
 *
 * The client is a thin facade over the Vercel AI SDK. We exercise it end-to-end
 * by stubbing the provider's `fetch` so that tests run hermetically without a
 * live LLM and verify both the wire format we send and the parsing of replies.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLlmClient } from './llm';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function makeJsonResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      id: 'test',
      object: 'chat.completion',
      created: 0,
      model: 'm',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

let captured: CapturedRequest;

function stubFetch(content: string): typeof globalThis.fetch {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const req = init ?? {};
    captured = {
      url: String(input),
      method: req.method ?? 'GET',
      headers: Object.fromEntries(new Headers(req.headers).entries()),
      body: typeof req.body === 'string' ? JSON.parse(req.body) : {},
    };
    return makeJsonResponse(content);
  }) as unknown as typeof globalThis.fetch;
}

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('LlmClient.chatJson', () => {
  beforeEach(() => {
    captured = { url: '', method: '', headers: {}, body: {} };
  });

  it('sends model + prompt + response_format and returns the parsed object', async () => {
    globalThis.fetch = stubFetch('{"ok":true,"n":42}');
    const client = createLlmClient({ baseURL: 'http://test.local/v1', apiKey: 'k', model: 'm' });

    const out = await client.chatJson({
      prompt: 'hi',
      schema: z.object({ ok: z.boolean(), n: z.number() }),
      schemaName: 'X',
    });

    expect(out).toEqual({ ok: true, n: 42 });
    expect(captured.url).toBe('http://test.local/v1/chat/completions');
    expect(captured.method).toBe('POST');
    expect(captured.headers.authorization).toBe('Bearer k');
    expect(captured.body.model).toBe('m');
    const messages = captured.body.messages as Array<{ role: string; content: string }>;
    expect(messages[0]?.role).toBe('user');
    expect(messages[0]?.content).toContain('hi');
    const responseFormat = captured.body.response_format as { type?: string };
    expect(responseFormat?.type).toBe('json_schema');
  });

  it('throws on non-retryable HTTP error (401)', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'invalid api key' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof globalThis.fetch;
    const client = createLlmClient({ baseURL: 'http://test.local/v1', apiKey: 'k', model: 'm' });

    await expect(client.chatJson({ prompt: 'x', schema: z.object({}) })).rejects.toThrow();
  });

  it('forwards reasoning_effort when reasoning is enabled', async () => {
    globalThis.fetch = stubFetch('{"ok":true,"n":1}');
    const client = createLlmClient({ baseURL: 'http://test.local/v1', apiKey: 'k', model: 'm' });

    await client.chatJson({
      prompt: 'x',
      schema: z.object({ ok: z.boolean(), n: z.number() }),
      reasoningEffort: 'high',
    });

    expect(captured.body.reasoning_effort).toBe('high');
  });
});

describe('LlmClient.chatVision', () => {
  beforeEach(() => {
    captured = { url: '', method: '', headers: {}, body: {} };
  });

  it('sends a multimodal user message with the image as base64', async () => {
    globalThis.fetch = stubFetch('# OCR result');
    const client = createLlmClient({
      baseURL: 'http://test.local/v1',
      apiKey: 'k',
      model: 'vision-m',
    });

    const out = await client.chatVision({ prompt: 'p', imageBase64: 'aGVsbG8=' });
    expect(out).toBe('# OCR result');
    expect(captured.body.model).toBe('vision-m');
    const messages = captured.body.messages as Array<{
      role: string;
      content: Array<{ type: string; text?: string; image_url?: { url: string } }>;
    }>;
    const parts = messages[0]?.content ?? [];
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ type: 'text', text: 'p' });
    expect(parts[1]?.type).toBe('image_url');
    expect(parts[1]?.image_url?.url).toContain('aGVsbG8=');
  });

  it('throws on non-retryable HTTP error (403)', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'forbidden' } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof globalThis.fetch;
    const client = createLlmClient({ baseURL: 'http://test.local/v1', apiKey: 'k', model: 'm' });
    await expect(client.chatVision({ prompt: 'p', imageBase64: 'x' })).rejects.toThrow();
  });
});

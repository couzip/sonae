/**
 * Tests for the OpenAI-compatible LLM client.
 *
 * The client speaks the chat-completions wire protocol; we mock global `fetch`
 * to verify the shape of outgoing requests and the parsing of responses.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLlmClient, type LlmClient } from './llm';

const ORIGINAL_FETCH = globalThis.fetch;

function makeJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('LlmClient.chatJson', () => {
  let client: LlmClient;

  beforeEach(() => {
    client = createLlmClient({
      baseURL: 'http://test.local/v1',
      apiKey: 'k',
      model: 'm',
      timeoutMs: 1000,
    });
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
  });

  it('sends model, messages, response_format and parses content', async () => {
    const captured: { url: string; body: any; headers: any } = {
      url: '',
      body: null,
      headers: {},
    };
    globalThis.fetch = vi.fn(async (input: any, init: any) => {
      captured.url = String(input);
      captured.body = JSON.parse(init.body);
      captured.headers = init.headers;
      return makeJsonResponse({
        choices: [{ message: { content: '{"ok":true,"n":42}' } }],
      });
    }) as any;

    const out = await client.chatJson<{ ok: boolean; n: number }>({
      prompt: 'hi',
      responseFormat: { type: 'json_schema', name: 'X' },
      maxTokens: 256,
      temperature: 0.5,
    });

    expect(out).toEqual({ ok: true, n: 42 });
    expect(captured.url).toBe('http://test.local/v1/chat/completions');
    expect(captured.body.model).toBe('m');
    expect(captured.body.messages[0].content).toBe('hi');
    expect(captured.body.temperature).toBe(0.5);
    expect(captured.body.max_tokens).toBe(256);
    expect(captured.headers.Authorization).toBe('Bearer k');
  });

  it('throws on non-OK HTTP', async () => {
    globalThis.fetch = vi.fn(async () => new Response('oops', { status: 500 })) as any;

    await expect(client.chatJson({ prompt: 'x', responseFormat: {} })).rejects.toThrow(/HTTP 500/);
  });

  it('repairs truncated JSON responses', async () => {
    globalThis.fetch = vi.fn(async () =>
      makeJsonResponse({ choices: [{ message: { content: '{"items":[1,2' } }] }),
    ) as any;

    const out = await client.chatJson<{ items: number[] }>({
      prompt: 'x',
      responseFormat: {},
    });
    expect(out).toEqual({ items: [1, 2] });
  });

  it('throws when content is unrecoverable garbage', async () => {
    globalThis.fetch = vi.fn(async () =>
      makeJsonResponse({ choices: [{ message: { content: 'not json :: ((' } }] }),
    ) as any;

    await expect(client.chatJson({ prompt: 'x', responseFormat: {} })).rejects.toThrow(
      /JSON parse failed/,
    );
  });
});

describe('LlmClient.chatVision', () => {
  let client: LlmClient;
  beforeEach(() => {
    client = createLlmClient({
      baseURL: 'http://test.local/v1',
      apiKey: 'k',
      model: 'vision-m',
      timeoutMs: 1000,
    });
  });
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it('sends a multimodal message with the image as data: url', async () => {
    const captured: any = {};
    globalThis.fetch = vi.fn(async (_url: any, init: any) => {
      captured.body = JSON.parse(init.body);
      return makeJsonResponse({ choices: [{ message: { content: '# OCR result' } }] });
    }) as any;

    const out = await client.chatVision({ prompt: 'p', imageBase64: 'abc' });
    expect(out).toBe('# OCR result');
    expect(captured.body.model).toBe('vision-m');
    const contentParts = captured.body.messages[0].content;
    expect(contentParts).toHaveLength(2);
    expect(contentParts[0]).toEqual({ type: 'text', text: 'p' });
    expect(contentParts[1].type).toBe('image_url');
    expect(contentParts[1].image_url.url).toBe('data:image/png;base64,abc');
  });

  it('falls back to reasoning_content when content is empty', async () => {
    globalThis.fetch = vi.fn(async () =>
      makeJsonResponse({
        choices: [{ message: { content: '', reasoning_content: 'fallback body' } }],
      }),
    ) as any;
    const out = await client.chatVision({ prompt: 'p', imageBase64: 'x' });
    expect(out).toBe('fallback body');
  });

  it('throws on non-OK HTTP', async () => {
    globalThis.fetch = vi.fn(async () => new Response('forbidden', { status: 403 })) as any;
    await expect(client.chatVision({ prompt: 'p', imageBase64: 'x' })).rejects.toThrow(
      /Vision HTTP 403/,
    );
  });
});

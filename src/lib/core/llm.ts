/**
 * OpenAI-compatible LLM/OCR client abstraction.
 *
 * Domain-agnostic: configure with any OpenAI-compatible endpoint (LM Studio,
 * Ollama, vLLM, OpenAI, Anthropic via proxy, Google Vertex AI, …).
 *
 * Two methods:
 * - `chatJson`   — text completion with `response_format` JSON schema
 * - `chatVision` — multimodal: image input + text prompt → text out (used for OCR)
 */

import { repairTruncatedJson } from './repairJson';

export interface LlmClientConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  /** Per-request timeout in ms. Default: 600_000 (10 min). */
  timeoutMs?: number;
}

export interface ChatJsonOptions {
  prompt: string;
  responseFormat: object; // OpenAI `response_format` shape (`{type:"json_schema", json_schema:{...}}`)
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface ChatVisionOptions {
  prompt: string;
  imageBase64: string;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmClient {
  readonly config: LlmClientConfig;
  chatJson<T = unknown>(opts: ChatJsonOptions): Promise<T>;
  chatVision(opts: ChatVisionOptions): Promise<string>;
}

const DEFAULT_TIMEOUT_MS = 600_000;

export function createLlmClient(config: LlmClientConfig): LlmClient {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    config,

    async chatJson<T>({
      prompt,
      responseFormat,
      maxTokens = 4096,
      temperature = 0,
      signal,
    }: ChatJsonOptions): Promise<T> {
      const r = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
          response_format: responseFormat,
        }),
        signal: signal ?? AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) {
        throw new Error(`LLM HTTP ${r.status}: ${await r.text()}`);
      }
      const body = await r.json();
      const text: string = body?.choices?.[0]?.message?.content ?? '';
      try {
        return JSON.parse(text) as T;
      } catch (e) {
        const repaired = repairTruncatedJson(text);
        if (repaired !== null) return repaired as T;
        throw new Error(
          `LLM JSON parse failed: ${(e as Error).message}. Raw: ${text.slice(0, 200)}`,
        );
      }
    },

    async chatVision({
      prompt,
      imageBase64,
      maxTokens = 4096,
      signal,
    }: ChatVisionOptions): Promise<string> {
      const r = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${imageBase64}` },
                },
              ],
            },
          ],
          temperature: 0,
          max_tokens: maxTokens,
        }),
        signal: signal ?? AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) {
        throw new Error(`Vision HTTP ${r.status}: ${await r.text()}`);
      }
      const body = await r.json();
      const msg = body?.choices?.[0]?.message ?? {};
      return (msg.content || msg.reasoning_content || '') as string;
    },
  };
}

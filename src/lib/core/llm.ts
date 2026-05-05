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

export type ReasoningEffort = 'off' | 'low' | 'medium' | 'high';

export interface ChatJsonOptions {
  prompt: string;
  responseFormat: object; // OpenAI `response_format` shape (`{type:"json_schema", json_schema:{...}}`)
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /**
   * Reasoning / thinking モードの強度。'off' は無効化、それ以外は OpenRouter / LiteLLM の
   * `extra_body: { reasoning: { enabled: true, effort: ... } }` 形式で送信される。
   * Gemma 4 a4b で発火させるには `reasoning_effort` 単独ではなく object 形式が必要。
   * デフォルト: 'off'。
   */
  reasoningEffort?: ReasoningEffort;
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
      maxTokens,
      temperature = 0,
      signal,
      reasoningEffort = 'off',
    }: ChatJsonOptions): Promise<T> {
      const requestBody: Record<string, unknown> = {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        response_format: responseFormat,
      };
      if (maxTokens != null) requestBody.max_tokens = maxTokens;
      if (reasoningEffort !== 'off') {
        requestBody.extra_body = {
          reasoning: { enabled: true, effort: reasoningEffort },
        };
      }
      const r = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: signal ?? AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) {
        throw new Error(`LLM HTTP ${r.status}: ${await r.text()}`);
      }
      const body = await r.json();
      const msg = body?.choices?.[0]?.message ?? {};
      // 一部 provider では reasoning モード時に content が空で reasoning_content
      // 側に最終回答が入るケースがある。OpenRouter は両方返すので content 優先で問題なし。
      const text: string = (msg.content || msg.reasoning_content || '') as string;
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
      maxTokens,
      signal,
    }: ChatVisionOptions): Promise<string> {
      const visionBody: Record<string, unknown> = {
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
      };
      if (maxTokens != null) visionBody.max_tokens = maxTokens;
      const r = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(visionBody),
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

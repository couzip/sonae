import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ProviderOptions } from '@ai-sdk/provider-utils';
import { generateObject, generateText, type LanguageModel } from 'ai';
import type { ZodType } from 'zod';

export interface LlmClientConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export type ReasoningEffort = 'off' | 'low' | 'medium' | 'high';

export interface ChatJsonOptions<T> {
  prompt: string;
  schema: ZodType<T>;
  schemaName?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
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
  readonly languageModel: LanguageModel;
  chatJson<T>(opts: ChatJsonOptions<T>): Promise<T>;
  chatVision(opts: ChatVisionOptions): Promise<string>;
}

const DEFAULT_TIMEOUT_MS = 600_000;
const PROVIDER_NAME = 'sonae';

function reasoningOptions(effort: ReasoningEffort): ProviderOptions | undefined {
  if (effort === 'off') return undefined;
  return { [PROVIDER_NAME]: { reasoningEffort: effort } };
}

export function createLlmClient(config: LlmClientConfig): LlmClient {
  const provider = createOpenAICompatible({
    name: PROVIDER_NAME,
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    supportsStructuredOutputs: true,
  });
  const languageModel = provider.languageModel(config.model);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutSignal = (signal: AbortSignal | undefined): AbortSignal =>
    signal ?? AbortSignal.timeout(timeoutMs);

  return {
    config,
    languageModel,

    async chatJson<T>(opts: ChatJsonOptions<T>): Promise<T> {
      const { object } = await generateObject({
        model: languageModel,
        schema: opts.schema,
        schemaName: opts.schemaName,
        prompt: opts.prompt,
        temperature: opts.temperature ?? 0,
        ...(opts.maxTokens != null ? { maxOutputTokens: opts.maxTokens } : {}),
        abortSignal: timeoutSignal(opts.signal),
        providerOptions: reasoningOptions(opts.reasoningEffort ?? 'off'),
      });
      return object as T;
    },

    async chatVision(opts: ChatVisionOptions): Promise<string> {
      const { text } = await generateText({
        model: languageModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: opts.prompt },
              { type: 'image', image: opts.imageBase64 },
            ],
          },
        ],
        temperature: 0,
        ...(opts.maxTokens != null ? { maxOutputTokens: opts.maxTokens } : {}),
        abortSignal: timeoutSignal(opts.signal),
      });
      return text;
    },
  };
}

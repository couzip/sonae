/**
 * LLM role registry: 役割ごとの env 解決とクライアントの生成を一箇所にまとめる。
 *
 * 各役割は専用 env ({ROLE}_LLM_BASE_URL/_API_KEY/_MODEL) を優先し、未指定なら
 * `main` (LLM_*) にフォールバックする (ocr のみ独立)。process が起動した時点で
 * 各 role のクライアントは lazy 初期化されキャッシュされる。
 */

import { createLlmClient, type LlmClient } from '@/lib/core';

export type LlmRole = 'main' | 'discovery' | 'toc' | 'step_a' | 'ocr' | 'next_actions' | 'chat';

interface RoleConfig {
  baseEnv: string;
  keyEnv: string;
  modelEnv: string;
  fallbackToMain: boolean;
  defaultModel: string;
}

const ROLES: Record<LlmRole, RoleConfig> = {
  main: {
    baseEnv: 'LLM_BASE_URL',
    keyEnv: 'LLM_API_KEY',
    modelEnv: 'LLM_MODEL',
    fallbackToMain: false,
    defaultModel: 'gemma-4-e4b-it@q4_k_s',
  },
  discovery: {
    baseEnv: 'DISCOVERY_LLM_BASE_URL',
    keyEnv: 'DISCOVERY_LLM_API_KEY',
    modelEnv: 'DISCOVERY_LLM_MODEL',
    fallbackToMain: true,
    defaultModel: 'gemma-4-e4b-it@q4_k_s',
  },
  toc: {
    baseEnv: 'TOC_LLM_BASE_URL',
    keyEnv: 'TOC_LLM_API_KEY',
    modelEnv: 'TOC_LLM_MODEL',
    fallbackToMain: true,
    defaultModel: 'gemma-4-e4b-it@q4_k_s',
  },
  step_a: {
    baseEnv: 'STEP_A_LLM_BASE_URL',
    keyEnv: 'STEP_A_LLM_API_KEY',
    modelEnv: 'STEP_A_LLM_MODEL',
    fallbackToMain: true,
    defaultModel: 'gemma-4-e4b-it@q4_k_s',
  },
  next_actions: {
    baseEnv: 'NEXT_ACTIONS_LLM_BASE_URL',
    keyEnv: 'NEXT_ACTIONS_LLM_API_KEY',
    modelEnv: 'NEXT_ACTIONS_LLM_MODEL',
    fallbackToMain: true,
    defaultModel: 'gemma-4-e4b-it@q4_k_s',
  },
  chat: {
    baseEnv: 'CHAT_LLM_BASE_URL',
    keyEnv: 'CHAT_LLM_API_KEY',
    modelEnv: 'CHAT_LLM_MODEL',
    fallbackToMain: true,
    defaultModel: 'gemma-4-e4b-it@q4_k_s',
  },
  ocr: {
    baseEnv: 'OCR_BASE_URL',
    keyEnv: 'OCR_API_KEY',
    modelEnv: 'OCR_MODEL',
    fallbackToMain: false,
    defaultModel: 'enginil/dots.mocr',
  },
};

const _cache = new Map<LlmRole, LlmClient>();

export function getLlm(role: LlmRole = 'main'): LlmClient {
  const cached = _cache.get(role);
  if (cached) return cached;

  const cfg = ROLES[role];
  const main = ROLES.main;
  const fb = cfg.fallbackToMain;

  const client = createLlmClient({
    baseURL:
      process.env[cfg.baseEnv] ??
      (fb ? process.env[main.baseEnv] : undefined) ??
      'http://localhost:1234/v1',
    apiKey: process.env[cfg.keyEnv] ?? (fb ? process.env[main.keyEnv] : undefined) ?? 'not-needed',
    model:
      process.env[cfg.modelEnv] ??
      (fb ? process.env[main.modelEnv] : undefined) ??
      cfg.defaultModel,
  });
  _cache.set(role, client);
  return client;
}

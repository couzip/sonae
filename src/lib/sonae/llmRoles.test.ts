import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('getLlm role-based config', () => {
  const ENV_KEYS = [
    'LLM_BASE_URL',
    'LLM_API_KEY',
    'LLM_MODEL',
    'TOC_LLM_BASE_URL',
    'TOC_LLM_API_KEY',
    'TOC_LLM_MODEL',
    'CHAT_LLM_BASE_URL',
    'CHAT_LLM_API_KEY',
    'CHAT_LLM_MODEL',
    'OCR_BASE_URL',
    'OCR_API_KEY',
    'OCR_MODEL',
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    vi.resetModules();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('main role は LLM_* を使う', async () => {
    process.env.LLM_BASE_URL = 'http://main.test/v1';
    process.env.LLM_API_KEY = 'main-key';
    process.env.LLM_MODEL = 'main-model';
    const { getLlm } = await import('./llmRoles');
    const c = getLlm('main');
    expect(c.config.baseURL).toBe('http://main.test/v1');
    expect(c.config.apiKey).toBe('main-key');
    expect(c.config.model).toBe('main-model');
  });

  it('toc role は TOC_LLM_* が無ければ LLM_* にフォールバック', async () => {
    process.env.LLM_BASE_URL = 'http://main.test/v1';
    process.env.LLM_API_KEY = 'main-key';
    process.env.LLM_MODEL = 'main-model';
    delete process.env.TOC_LLM_BASE_URL;
    delete process.env.TOC_LLM_API_KEY;
    delete process.env.TOC_LLM_MODEL;
    const { getLlm } = await import('./llmRoles');
    const c = getLlm('toc');
    expect(c.config.baseURL).toBe('http://main.test/v1');
    expect(c.config.model).toBe('main-model');
  });

  it('toc role に TOC_LLM_* が指定されればそれを使う', async () => {
    process.env.LLM_BASE_URL = 'http://main.test/v1';
    process.env.TOC_LLM_BASE_URL = 'http://toc.test/v1';
    process.env.TOC_LLM_API_KEY = 'toc-key';
    process.env.TOC_LLM_MODEL = 'toc-model';
    const { getLlm } = await import('./llmRoles');
    const c = getLlm('toc');
    expect(c.config.baseURL).toBe('http://toc.test/v1');
    expect(c.config.apiKey).toBe('toc-key');
    expect(c.config.model).toBe('toc-model');
  });

  it('chat role は CHAT_LLM_* が指定されればそれを使う', async () => {
    process.env.LLM_BASE_URL = 'http://main.test/v1';
    process.env.CHAT_LLM_BASE_URL = 'http://chat.test/v1';
    process.env.CHAT_LLM_API_KEY = 'chat-key';
    process.env.CHAT_LLM_MODEL = 'gemma-4-26b-a4b-it';
    const { getLlm } = await import('./llmRoles');
    const c = getLlm('chat');
    expect(c.config.baseURL).toBe('http://chat.test/v1');
    expect(c.config.apiKey).toBe('chat-key');
    expect(c.config.model).toBe('gemma-4-26b-a4b-it');
  });

  it('chat role は CHAT_LLM_* が無ければ LLM_* にフォールバック', async () => {
    process.env.LLM_BASE_URL = 'http://main.test/v1';
    process.env.LLM_API_KEY = 'main-key';
    process.env.LLM_MODEL = 'main-model';
    delete process.env.CHAT_LLM_BASE_URL;
    delete process.env.CHAT_LLM_API_KEY;
    delete process.env.CHAT_LLM_MODEL;
    const { getLlm } = await import('./llmRoles');
    const c = getLlm('chat');
    expect(c.config.baseURL).toBe('http://main.test/v1');
    expect(c.config.model).toBe('main-model');
  });

  it('ocr role は LLM_* にフォールバックしない (独立)', async () => {
    process.env.LLM_BASE_URL = 'http://main.test/v1';
    process.env.LLM_MODEL = 'main-model';
    delete process.env.OCR_BASE_URL;
    delete process.env.OCR_MODEL;
    const { getLlm } = await import('./llmRoles');
    const c = getLlm('ocr');
    expect(c.config.baseURL).toBe('http://localhost:1234/v1'); // ocr 専用デフォルト
    expect(c.config.model).toBe('enginil/dots.mocr'); // ocr 専用デフォルト
  });
});

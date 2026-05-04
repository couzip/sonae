/**
 * File-system backed cache implementations of the `Cache` interface.
 *
 * - `JsonFileCache<T>`     : JSON-serializable values, atomic write via tmp+rename
 * - `TextFileCache`        : UTF-8 text bodies (e.g. OCR markdown)
 * - `BinaryFileCache`      : raw bytes (e.g. PDFs)
 *
 * All caches use `cacheRoot/{namespace}/{key}.{ext}` layout. Sub-namespaces are
 * supplied by the caller; this module is domain-agnostic.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type { Cache, PipelineContext } from './types';

export interface FileCacheOptions {
  /** Absolute path of the namespaced directory, e.g. `<root>/cache/ocr`. */
  dir: string;
  /** File extension (without dot), e.g. `'json'`, `'md'`, `'pdf'`. */
  ext: string;
  /**
   * Filename builder. Defaults to `${key}.${ext}`. Override for layouts like
   * `${key}.meta.json` paired with a primary file.
   */
  filename?: (key: string, ext: string) => string;
}

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

function resolveFilePath(opts: FileCacheOptions, key: string): string {
  const fn = opts.filename ?? ((k, e) => `${k}.${e}`);
  return join(opts.dir, fn(key, opts.ext));
}

function writeAtomic(path: string, body: Buffer | string) {
  ensureDir(dirname(path));
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, body as Buffer);
  renameSync(tmp, path);
}

function safeUnlink(path: string) {
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // ignore
  }
}

export class JsonFileCache<T> implements Cache<string, T> {
  constructor(private readonly opts: FileCacheOptions) {}

  async read(key: string, _ctx: PipelineContext): Promise<T | null> {
    const path = resolveFilePath(this.opts, key);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as T;
    } catch {
      return null;
    }
  }

  async write(key: string, value: T, _ctx: PipelineContext): Promise<void> {
    const path = resolveFilePath(this.opts, key);
    writeAtomic(path, JSON.stringify(value, null, 2));
  }

  async invalidate(key: string, _ctx: PipelineContext): Promise<void> {
    safeUnlink(resolveFilePath(this.opts, key));
  }
}

export class TextFileCache implements Cache<string, string> {
  constructor(private readonly opts: FileCacheOptions) {}

  async read(key: string, _ctx: PipelineContext): Promise<string | null> {
    const path = resolveFilePath(this.opts, key);
    if (!existsSync(path)) return null;
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      return null;
    }
  }

  async write(key: string, value: string, _ctx: PipelineContext): Promise<void> {
    writeAtomic(resolveFilePath(this.opts, key), value);
  }

  async invalidate(key: string, _ctx: PipelineContext): Promise<void> {
    safeUnlink(resolveFilePath(this.opts, key));
  }
}

export class BinaryFileCache implements Cache<string, Buffer> {
  constructor(private readonly opts: FileCacheOptions) {}

  async read(key: string, _ctx: PipelineContext): Promise<Buffer | null> {
    const path = resolveFilePath(this.opts, key);
    if (!existsSync(path)) return null;
    try {
      return readFileSync(path);
    } catch {
      return null;
    }
  }

  async write(key: string, value: Buffer, _ctx: PipelineContext): Promise<void> {
    writeAtomic(resolveFilePath(this.opts, key), value);
  }

  async invalidate(key: string, _ctx: PipelineContext): Promise<void> {
    safeUnlink(resolveFilePath(this.opts, key));
  }
}

/**
 * "Reference" cache: stores a path/handle (string) to a separately-managed
 * binary file rather than the bytes themselves. Useful when the consumer wants
 * to read the file lazily (e.g. PDF rendering streaming through pdfjs).
 */
export class PathHandleCache implements Cache<string, string> {
  constructor(private readonly opts: FileCacheOptions) {}

  async read(key: string, _ctx: PipelineContext): Promise<string | null> {
    const path = resolveFilePath(this.opts, key);
    return existsSync(path) ? path : null;
  }

  async write(key: string, value: string, _ctx: PipelineContext): Promise<void> {
    // Caller already wrote the file at `value`; we only need to ensure the
    // expected location matches. If it does, no-op. Otherwise, copy.
    const expected = resolveFilePath(this.opts, key);
    if (value === expected) return;
    const src = readFileSync(value);
    writeAtomic(expected, src);
  }

  async invalidate(key: string, _ctx: PipelineContext): Promise<void> {
    safeUnlink(resolveFilePath(this.opts, key));
  }
}

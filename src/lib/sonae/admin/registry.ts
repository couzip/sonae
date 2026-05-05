/**
 * 管理画面から `data/municipalities.yaml` を round-trip で書き換える。
 * yaml の Document API を使い、コメント (例: `# 神奈川県`) を保持したまま追記/編集/削除する。
 *
 * 書き込み後は `invalidateRegistryCache()` を呼んで `loadRegistry()` の lazy cache を破棄する。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { Document, parseDocument, YAMLMap, YAMLSeq } from 'yaml';
import { MunicipalitySchema, type Municipality } from '../schemas';
import { invalidateRegistryCache, registryYamlPath } from '../municipality';

function readDoc(): Document {
  const raw = readFileSync(registryYamlPath(), 'utf-8');
  return parseDocument(raw);
}

function writeDoc(doc: Document): void {
  const out = doc.toString({ lineWidth: 0 });
  writeFileSync(registryYamlPath(), out, 'utf-8');
  invalidateRegistryCache();
}

function getSeq(doc: Document): YAMLSeq {
  const contents = doc.contents;
  if (!(contents instanceof YAMLSeq)) {
    throw new Error('municipalities.yaml: 期待するトップレベルは Sequence ですが違います');
  }
  return contents;
}

function entryCode(item: unknown): string | null {
  if (!(item instanceof YAMLMap)) return null;
  const code = item.get('code');
  return typeof code === 'string' ? code : null;
}

function entryPrefecture(item: unknown): string | null {
  if (!(item instanceof YAMLMap)) return null;
  const pref = item.get('prefecture');
  return typeof pref === 'string' ? pref : null;
}

function buildEntryNode(doc: Document, m: Municipality): YAMLMap {
  const node = doc.createNode(m, { flow: false });
  if (!(node instanceof YAMLMap)) {
    throw new Error('createNode は YAMLMap を返すはず');
  }
  // name_aliases は flow style ([a, b, c]) のほうが既存ファイルと揃う
  const aliases = node.get('name_aliases', true);
  if (aliases instanceof YAMLSeq) {
    aliases.flow = true;
  }
  return node;
}

export function listRegistryEntries(): Municipality[] {
  const doc = readDoc();
  const seq = getSeq(doc);
  return seq.items.map((item) => {
    const obj = (item as YAMLMap).toJSON();
    return MunicipalitySchema.parse(obj);
  });
}

/**
 * 新規エントリを追加する。同じ code が既に存在すれば throw する。
 * 同一 prefecture の既存エントリ群の末尾に挿入し、無ければファイル末尾に
 * `# {prefecture}` コメント付きで append する。
 */
export function addRegistryEntry(input: Municipality): void {
  const parsed = MunicipalitySchema.parse(input);
  const doc = readDoc();
  const seq = getSeq(doc);

  if (seq.items.some((it) => entryCode(it) === parsed.code)) {
    throw new Error(`code=${parsed.code} は既に登録済`);
  }

  const node = buildEntryNode(doc, parsed);

  // 同じ prefecture の最後の index を探す
  let lastSamePref = -1;
  for (let i = 0; i < seq.items.length; i++) {
    if (entryPrefecture(seq.items[i]) === parsed.prefecture) {
      lastSamePref = i;
    }
  }

  if (lastSamePref >= 0) {
    seq.items.splice(lastSamePref + 1, 0, node);
  } else {
    // 新しい prefecture: コメントを付けて末尾に append
    (node as { commentBefore?: string }).commentBefore = ` ${parsed.prefecture}`;
    seq.items.push(node);
  }

  writeDoc(doc);
}

/**
 * 既存エントリを編集する。code は変更不可。
 */
export function updateRegistryEntry(code: string, patch: Partial<Municipality>): void {
  const doc = readDoc();
  const seq = getSeq(doc);
  const idx = seq.items.findIndex((it) => entryCode(it) === code);
  if (idx < 0) throw new Error(`code=${code} not found`);
  if (patch.code && patch.code !== code) {
    throw new Error('code は変更できません');
  }

  const current = (seq.items[idx] as YAMLMap).toJSON() as Municipality;
  const merged = MunicipalitySchema.parse({ ...current, ...patch, code });
  const node = buildEntryNode(doc, merged);

  // prefecture が変わった場合は移動
  if (current.prefecture !== merged.prefecture) {
    seq.items.splice(idx, 1);
    let lastSamePref = -1;
    for (let i = 0; i < seq.items.length; i++) {
      if (entryPrefecture(seq.items[i]) === merged.prefecture) {
        lastSamePref = i;
      }
    }
    if (lastSamePref >= 0) {
      seq.items.splice(lastSamePref + 1, 0, node);
    } else {
      (node as { commentBefore?: string }).commentBefore = ` ${merged.prefecture}`;
      seq.items.push(node);
    }
  } else {
    seq.items[idx] = node;
  }

  writeDoc(doc);
}

/**
 * registry からエントリを削除する。cache (cache/...) は連鎖削除しない (別操作)。
 */
export function deleteRegistryEntry(code: string): void {
  const doc = readDoc();
  const seq = getSeq(doc);
  const idx = seq.items.findIndex((it) => entryCode(it) === code);
  if (idx < 0) throw new Error(`code=${code} not found`);
  seq.items.splice(idx, 1);
  writeDoc(doc);
}

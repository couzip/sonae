// 防災計画 PDF から LLM が抽出する値には「記載なし」「不明」「—」「N/A」など
// プレースホルダ的な無意味文字列が混じる。UI ではこれらを表示しないため、
// 表示前に必ずこの関数で値を篩いに掛ける。

const PLACEHOLDER_RE = /^(記載なし|不明|—|-|n\/a|na|null|none|undefined|不詳|なし|無し|未記載)$/i;

export function isMeaningful(value: string | undefined | null): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !PLACEHOLDER_RE.test(trimmed);
}

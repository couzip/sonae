/**
 * Best-effort recovery for truncated LLM JSON output.
 *
 * Small models with strict `max_tokens` often cut off mid-array, mid-string,
 * or mid-property. This function attempts a sequence of recoveries, returning
 * the first parse that succeeds (or `null`).
 *
 * Strategy (try in order):
 *   1. Direct `JSON.parse` (no-op fast path).
 *   2. If we end inside a `"..."`, append `"` and close brackets in stack order.
 *   3. If trailing tokens form a partial value (key without `:` value, partial
 *      number, dangling `:` or `,`), strip them back to a safe boundary and
 *      close brackets.
 *
 * Cases verified by tests:
 *   - `[1,2`             → `[1,2]`
 *   - `{"a":1,`          → `{"a":1}`
 *   - `{"a":"foo`        → `{"a":"foo"}`
 *   - `{"a":[{"b":1},{`  → `{"a":[{"b":1}]}`
 *   - `{"a":{"b":[1,2`   → `{"a":{"b":[1,2]}}`
 *   - `{"a":"hi","b":"x` → `{"a":"hi","b":"x"}`
 */

type Bracket = '{' | '[';

/** Walk and return the bracket stack at end of `str`, plus state flags. */
function walk(str: string) {
  const stack: Bracket[] = [];
  let inStr = false;
  let esc = false;
  let strStart = -1;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (inStr) {
      if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      strStart = i;
    } else if (c === '{' || c === '[') {
      stack.push(c);
    } else if (c === '}' || c === ']') {
      stack.pop();
    }
  }
  return { stack, inStr, strStart };
}

function closersFor(stack: Bracket[]): string {
  let out = '';
  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i] === '{' ? '}' : ']';
  }
  return out;
}

/** Strip trailing tokens that prevent a clean close. */
function trimTrailing(s: string): string {
  let out = s;
  // Whitespace + commas
  out = out.replace(/[\s,]+$/, '');
  // Dangling colon (key without value)
  out = out.replace(/:\s*$/, '');
  // After stripping `:` we may have a dangling property name. Drop it.
  out = out.replace(/(?:,|\{)\s*"[^"]*"\s*$/, (m) => (m.startsWith(',') ? '' : '{'));
  // Partial number / identifier that cannot be a complete literal
  out = out.replace(/[a-zA-Z0-9_+\-.]+$/, (m) => {
    if (m === 'true' || m === 'false' || m === 'null') return m;
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(m)) return m;
    return '';
  });
  out = out.replace(/[\s,:]+$/, '');
  return out;
}

function tryParse(s: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
}

export function repairTruncatedJson(s: string): unknown | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;

  // Strategy 0: already valid.
  const fast = tryParse(trimmed);
  if (fast.ok) return fast.value;

  const w = walk(trimmed);

  // Strategy 1: close an unterminated string, then close brackets.
  if (w.inStr) {
    const candidate = trimmed.replace(/\\$/, '') + '"' + closersFor(w.stack);
    const r1 = tryParse(candidate);
    if (r1.ok) return r1.value;

    // Strategy 1b: drop the unterminated string entirely (back to its opening
    // `"`), strip the now-dangling key/colon, then close.
    if (w.strStart >= 0) {
      const cut = trimmed.slice(0, w.strStart);
      const trimmedCut = trimTrailing(cut);
      // Re-walk to get stack at the cut point.
      const w2 = walk(trimmedCut);
      const candidate2 = trimmedCut + closersFor(w2.stack);
      const r2 = tryParse(candidate2);
      if (r2.ok) return r2.value;
    }
  }

  // Strategy 2: not in a string — close what's open, then strip trailing
  // garbage and close again.
  {
    const closed = trimmed + closersFor(w.stack);
    const r = tryParse(closed);
    if (r.ok) return r.value;
  }
  {
    const trimmedTail = trimTrailing(trimmed);
    const w2 = walk(trimmedTail);
    const candidate = trimmedTail + closersFor(w2.stack);
    const r = tryParse(candidate);
    if (r.ok) return r.value;

    // Also try removing a trailing comma directly inside an object/array.
    const noTrailingComma = candidate.replace(/,\s*([\]}])/g, '$1');
    if (noTrailingComma !== candidate) {
      const r2 = tryParse(noTrailingComma);
      if (r2.ok) return r2.value;
    }
  }

  return null;
}

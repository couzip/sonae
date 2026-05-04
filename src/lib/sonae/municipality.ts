/**
 * Sonae municipality registry loader.
 *
 * Reads `data/municipalities.yaml` and provides lookups by code, name (with
 * alias / fuzzy match), or nearest coordinates. Loaded once and cached.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { MunicipalitySchema, type Municipality } from './schemas';

let _registry: Municipality[] | null = null;

function loadRegistry(): Municipality[] {
  if (_registry) return _registry;
  const path = join(process.cwd(), 'data', 'municipalities.yaml');
  const raw = readFileSync(path, 'utf-8');
  const data = parseYaml(raw);
  _registry = z.array(MunicipalitySchema).parse(data);
  return _registry;
}

export function findByCode(code: string): Municipality | null {
  return loadRegistry().find((m) => m.code === code) ?? null;
}

export function findByName(query: string): Municipality | null {
  const reg = loadRegistry();
  const trimmed = query.replace(/\s+/g, '').trim();
  if (!trimmed) return null;

  // exact name → alias exact → contains
  const exact = reg.find((m) => m.name === trimmed);
  if (exact) return exact;

  const alias = reg.find((m) => m.name_aliases.some((a) => a === trimmed));
  if (alias) return alias;

  return (
    reg.find((m) => trimmed.includes(m.name) || m.name_aliases.some((a) => trimmed.includes(a))) ??
    null
  );
}

/** Nearest registry entry by squared-degree distance. Registry-internal only. */
export function findNearestByCoords(lat: number, lng: number): Municipality | null {
  let best: Municipality | null = null;
  let bestDist = Infinity;
  for (const m of loadRegistry()) {
    if (m.lat == null || m.lng == null) continue;
    const dlat = m.lat - lat;
    const dlng = m.lng - lng;
    const d = dlat * dlat + dlng * dlng;
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

export function listRegistry(): Municipality[] {
  return loadRegistry();
}

/**
 * Sonae countermeasure master loader (server-only).
 *
 * Reads `data/countermeasures.yaml` (74 disaster countermeasures), validates
 * with Zod, returns a `Countermeasure[]` typed against the client-safe shape
 * defined in `lib/countermeasures-filter.ts`.
 *
 * Clients must import the type + pure filter functions from
 * `@/lib/sonae/client/countermeasures-filter`, not from this file (which pulls in `node:fs`).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { filterByDisaster, type Countermeasure } from '@/lib/sonae/client/countermeasures-filter';
import { disasterJpToEnum } from '@/lib/sonae/client/disaster-mapping';

const EffortLevel = z.enum(['low', 'medium', 'high']);
const ImpactLevel = z.enum(['low', 'medium', 'high', 'very_high']);

const ApplicabilitySchema = z.object({
  ownership: z.array(z.enum(['owned', 'rented'])).default(['owned', 'rented']),
  building_type: z.array(z.enum(['wood', 'steel', 'rc', 'src', 'any'])).default(['any']),
  min_year_built: z.number().nullable().optional(),
  max_year_built: z.number().nullable().optional(),
  has_member: z
    .array(
      z.enum(['alone', 'adults', 'children', 'infant', 'elderly', 'care_needed', 'pets', 'any']),
    )
    .default(['any']),
  location_type: z
    .array(z.enum(['coastal', 'inland', 'mountainous', 'urban', 'any']))
    .default(['any']),
});

const CountermeasureSchema = z.object({
  id: z.string(),
  category: z.string(),
  disaster_group: z.string(),
  label: z.string(),
  short_description: z.string().optional(),
  applicable_disasters: z.array(z.string()),
  applicability: ApplicabilitySchema,
  effort: z.object({
    time: EffortLevel,
    cost: EffortLevel,
    skill: EffortLevel,
  }),
  impact: ImpactLevel,
  detail: z
    .object({
      why: z.string().optional(),
      how: z.string().optional(),
      references: z
        .array(z.object({ title: z.string(), url: z.string().nullable().optional() }))
        .optional(),
      related_actions: z.array(z.string()).optional(),
    })
    .optional(),
});

let _master: Countermeasure[] | null = null;

export function loadCountermeasures(): Countermeasure[] {
  if (_master) return _master;
  const path = join(process.cwd(), 'data', 'countermeasures.yaml');
  const raw = readFileSync(path, 'utf-8');
  const data = parseYaml(raw);
  _master = z.array(CountermeasureSchema).parse(data) as Countermeasure[];
  return _master;
}

export function filterByDetectedDisasters(
  master: Countermeasure[],
  detectedDisasterTypesJp: string[],
): Countermeasure[] {
  const detectedEnums = detectedDisasterTypesJp.map(disasterJpToEnum);
  return filterByDisaster(master, detectedEnums);
}

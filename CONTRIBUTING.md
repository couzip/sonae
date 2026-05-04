# Contributing to Sonae

Thanks for your interest. Sonae is intended both as a working pre-disaster preparedness
app for Japan and as an **OSS reference implementation** for using lightweight LLMs to
consolidate scattered, fragmented public information into structured form.

If you're here for the framework / pipeline pattern (not the disaster domain), start with
[`docs/EXTENDING.md`](docs/EXTENDING.md).

## Development setup

```bash
git clone <fork>
cd app
npm install
# postinstall installs Playwright Chromium; skip with `npm install --ignore-scripts`
# if you only need the framework parts.

cp .env.example .env
# edit if you're not using LM Studio defaults

npm run dev
```

## Required commands before opening a PR

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # next lint
npm run format:check  # prettier --check
npm run test          # vitest run
```

CI runs all four on Node 20.x and 22.x.

## Coding conventions

- **TypeScript strict mode** (no `any` exempt without justification).
- **No runtime hacks**: no `eval('require')`, no hardcoded `node_modules/...` paths,
  no monkey-patching of upstream libraries. If a dependency has a bug that affects us,
  file an issue upstream and document a clean local workaround.
- **Pure functions in `src/lib/core/`** — no Node-only imports (`fs`, `path`) at module
  top level. The framework must be importable in any TS-compatible environment.
- **Domain code lives in `src/lib/sonae/`** — disaster-specific schemas, registries,
  prompts. Keep this independent of the core so it can be replaced wholesale by another
  domain.
- **Comments**: explain non-obvious *why*, not *what*. The code says what.

## File-by-file ownership

| Path | Concern | OK to import Node fs? |
|---|---|---|
| `src/lib/core/` | Framework: pipeline, cache, llm-client, schemas, types | Server-only modules can; pure-function modules cannot |
| `src/lib/sonae/` | Domain: countermeasures, municipality, prompts | Yes (server-side only) |
| `src/components/` | UI | No (client side, React server components OK if no Node imports) |
| `src/app/api/` | Route handlers | Yes |
| `src/stores/` | Zustand stores (client) | No |

## Submitting a PR

1. Branch off `main`: `git checkout -b feat/<short>` or `fix/<short>`.
2. Run the four required commands.
3. Update or add tests for behavior changes.
4. Update `docs/EXTENDING.md` if the framework surface changed.
5. Open a PR using the template; fill in the test plan.

## Adding a new municipality

`data/municipalities.yaml` is hand-curated. To add a city:

```yaml
- code: '<5-digit JIS code>'
  name: <Japanese name>
  prefecture: <prefecture name>
  prefecture_code: '<2-digit>'
  lat: <latitude>
  lng: <longitude>
  name_aliases: [<alternates for fuzzy match>]
  disaster_plan_url: <direct PDF URL — preferred>
  disaster_plan_label: <human label>
  disaster_plan_page_url: <citing source page>
```

`disaster_plan_url` is preferred over relying on browser-use Discovery — it's
deterministic, faster, and doesn't depend on Google search availability.

## Reporting a security issue

Please email <security@example.org> rather than filing a public issue. The repo will
be updated with a real address before the first public release.

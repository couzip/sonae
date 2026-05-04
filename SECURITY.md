# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Sonae, please **do not** open a
public GitHub issue. Instead, report it privately so we can fix and
coordinate disclosure.

- Email: replace with a real address before first public release
- Subject prefix: `[Sonae security]`
- Expected response time: 5 business days for acknowledgement

When reporting, please include:

- A description of the vulnerability
- Steps to reproduce (or proof-of-concept code)
- The version / commit affected
- Impact assessment (what an attacker could achieve)

## Scope

In scope:

- The Sonae app itself (`src/lib/sonae/`, `src/components/`, `src/app/`)
- The reusable framework (`src/lib/core/`)
- Default configuration and example pipelines (`examples/`)

Out of scope:

- Third-party services (LM Studio, Ollama, OpenAI, GSI tile servers)
- Self-hosted user models or data caches
- CVEs in dependencies that have not yet been disclosed upstream — we will
  pick up patches via Dependabot

## Known operational risks (not vulnerabilities)

- **Discovery layer fallback** opens `google.com/search` via browser-use when
  no `disaster_plan_url` is registered. This is a Google ToS issue, not a
  user-security issue. Documented in `README.md`.
- **Profile data is sent to the LLM** during `/api/next-actions`. The user
  consents implicitly by submitting the form. Use a self-hosted LLM
  (LM Studio / Ollama) if you want zero off-device profile data.
- **PDF cache is on disk by default** at `cache/`. On shared file systems
  ensure the directory has appropriate permissions. Override with
  `SONAE_CACHE_DIR` to redirect (e.g. to `/tmp` on read-only deploys).

## Supported versions

Sonae has not yet released a stable 1.x. Until then, only the `main` branch
receives security fixes.

| Version | Supported |
|---------|-----------|
| `main`  | ✅ |
| 0.x tags | ❌ best effort only |

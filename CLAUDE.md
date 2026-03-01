# CLAUDE.md

This file provides guidance for working in the standalone MyWords workspace at `/Users/trey/Desktop/Apps/MyLife/MyWords`.

## Overview

MyWords standalone is an isolated app workspace for dictionary/thesaurus UX, running independently from MyLife hub integration.

## TypeScript Requirement

- TypeScript-first across all apps and packages in this project.
- New runtime code should be .ts/.tsx with strict typing and no implicit any.
- Use .js/.cjs only where required by tooling or platform constraints.

## Isolation Boundary (Critical)

- Standalone MyWords source code belongs under this directory only.
- MyLife hub integration is maintained separately in:
  - `/Users/trey/Desktop/Apps/MyLife/modules/words`
  - `/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/(words)`
  - `/Users/trey/Desktop/Apps/MyLife/apps/web/app/words`
- Keep standalone and hub implementations decoupled except for intentional shared specs/docs.

## Current Status

- Runnable standalone runtime is implemented for web and mobile.

## Stack

- **Language:** TypeScript
- **Mobile:** Expo + Expo Router (`apps/mobile/`)
- **Web:** Next.js 15 App Router (`apps/web/`)
- **Shared package:** `@mywords/shared` (`packages/shared/`)
- **Monorepo:** Turborepo + pnpm workspace

## Key Commands

```bash
cd /Users/trey/Desktop/Apps/MyLife/MyWords
pnpm install
pnpm dev:web
pnpm dev:mobile
pnpm typecheck
```

## Architecture

- `apps/web/app/page.tsx`: standalone dictionary/thesaurus interface.
- `apps/mobile/app/index.tsx`: standalone mobile lookup interface.
- `packages/shared/src/index.ts`: shared lookup API logic (dictionary, thesaurus, rhymes, history enrichment).


## File Ownership Zones (Parallel Agent Work)

| Zone | Owner | Files |
|------|-------|-------|
| Root configs | lead | `package.json`, `turbo.json`, `pnpm-workspace.yaml` |
| Shared logic | core-dev | `packages/shared/**` |
| Mobile App | mobile-dev | `apps/mobile/**` |
| Web App | web-dev | `apps/web/**` |
| Tests | tester | `**/*.test.ts`, `**/*.test.tsx` |
| Docs | docs-dev | `CLAUDE.md`, `AGENTS.md` |

## Agent Teams Strategy

When 2+ plans target this project with overlapping scope, use an Agent Team instead of parallel subagents. Custom agent definitions from `/Users/trey/Desktop/Apps/.claude/agents/` and `/Users/trey/Desktop/Apps/MyLife/.claude/agents/`:
- `plan-executor` -- Execute plan phases with testing and verification
- `test-writer` -- Write tests without modifying source code
- `docs-agent` -- Update documentation
- `reviewer` -- Read-only code review (uses Sonnet)

Agents working in different File Ownership Zones can run in parallel without conflicts. Agents sharing a zone must coordinate via the team task list.

## Writing Style
- Do not use em dashes in documents or writing.

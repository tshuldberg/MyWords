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

# MyWords (Standalone)

Standalone MyWords app workspace.

This directory is intentionally isolated from MyLife hub runtime code.

## Run

```bash
cd /Users/trey/Desktop/Apps/MyLife/MyWords
pnpm install
pnpm dev:web
pnpm dev:mobile
```

## Workspace Layout

- `apps/web/` — Next.js standalone web runtime
- `apps/mobile/` — Expo standalone mobile runtime
- `packages/shared/` — shared lookup/domain logic for web + mobile

## Relationship to MyLife Hub

- Standalone app code: `MyWords/` (this directory)
- Hub module code: `modules/words/`
- Hub UI routes:
  - `apps/mobile/app/(words)/`
  - `apps/web/app/words/`

The standalone app and hub module are intentionally decoupled.

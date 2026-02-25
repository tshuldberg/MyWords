# MyWords Timeline

Tracks development sessions and changes for the standalone MyWords workspace.

---

## 2026-02-25 — Standalone Workspace Scaffolded

**Session:** Isolation scaffold within MyLife workspace

### Actions
- Created standalone `MyWords/` directory with independent docs and structure.
- Added synchronized `AGENTS.md` + `CLAUDE.md` rules for isolation boundaries.
- Added initial app/package scaffold folders.

### Notes
- Standalone and MyLife hub implementations are intentionally separate.

## 2026-02-25 — Standalone Runtime Added

**Session:** Build runnable standalone app surfaces

### Actions
- Added standalone monorepo scripts and tooling (`package.json`, `turbo.json`, `.gitignore`).
- Added `apps/web` Next.js runtime with standalone MyWords lookup UI.
- Added `apps/mobile` Expo runtime with standalone MyWords lookup UI.
- Added `packages/shared` lookup/domain package used by both runtimes.

### Notes
- Standalone app runtime is now runnable via `pnpm dev:web` and `pnpm dev:mobile` in `MyWords/`.

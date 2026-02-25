# AGENTS.md

Project-specific agent instructions for `/Users/trey/Desktop/Apps/MyLife/MyWords`.

## Instruction Pair (Critical)

- Keep this file and `CLAUDE.md` synchronized for persistent project rules.
- When a long-lived workflow or constraint changes, update both files in the same session.

## TypeScript Requirement (Critical)

- Default to TypeScript for application and shared package code whenever feasible.
- For new product/runtime code, prefer .ts/.tsx over .js/.jsx.
- Use JavaScript only when a toolchain file requires it.

## Isolation Boundary (Critical)

- `MyWords/` is the standalone app workspace and must remain isolated from MyLife hub runtime code.
- Hub integration lives in `/Users/trey/Desktop/Apps/MyLife/modules/words` and `/Users/trey/Desktop/Apps/MyLife/apps/*/words`.
- Do not place standalone MyWords source files in the MyLife root.

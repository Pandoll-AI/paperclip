# Kawaii UI Strategy

## Current State

- Upstream source is `paperclipai/paperclip`.
- The local integration branch is `kawaii-ui`.
- The app is a pnpm monorepo.
- The board UI lives in `ui/` as a React + Vite app.
- The root `pnpm dev` command serves API and UI together.
- Shared design tokens start in `ui/src/index.css`.
- App chrome starts in `ui/src/components/Layout.tsx`.
- Routes start in `ui/src/App.tsx`.
- Reusable UI primitives live in `ui/src/components/ui/`.

## Goal

Keep the product behavior close to upstream while making the visual system consistently kawaii.

The fork should absorb upstream updates with small, predictable conflicts.

## Branch Model

Use these long-lived refs:

- `upstream/master`: untouched Paperclip upstream.
- `kawaii-ui`: local product branch with kawaii UI work.

Update flow:

```sh
git fetch upstream
git checkout kawaii-ui
git rebase upstream/master
pnpm install
pnpm -r typecheck
pnpm test:run
pnpm build
```

Avoid committing directly to `master`.

## Code Boundary

Put fork-specific UI code under:

```txt
ui/src/kawaii/
```

Suggested files:

```txt
ui/src/kawaii/theme.css
ui/src/kawaii/KawaiiChrome.tsx
ui/src/kawaii/motion.ts
ui/src/kawaii/brand.ts
ui/src/kawaii/README.md
```

Only touch upstream files at narrow mount points:

- `ui/src/main.tsx`: import `ui/src/kawaii/theme.css` after `index.css`.
- `ui/src/components/Layout.tsx`: wrap or decorate the board shell with `KawaiiChrome`.
- `ui/src/components/ui/*`: adjust shared primitives only when CSS tokens cannot express the change.

## Styling Rule

Prefer CSS variables and Tailwind layer overrides before JSX rewrites.

Good targets:

- `--background`
- `--foreground`
- `--card`
- `--primary`
- `--secondary`
- `--accent`
- `--border`
- `--ring`
- `--sidebar`
- `--radius-*`

This keeps most upstream component changes mergeable.

## Component Rule

Do not fork entire pages unless the page structure itself needs to change.

Use this order:

1. Token/theme override.
2. Shared primitive adjustment.
3. Layout shell decoration.
4. Page-level rewrite.

Page-level rewrites should be rare and documented in `ui/src/kawaii/README.md`.

## Kawaii Direction

This should still feel like an operator tool.

Use:

- warm paper-like surfaces
- soft but readable borders
- compact controls
- a few mascot or stationery motifs
- gentle motion for hover, active states, and route/chrome transitions

Avoid:

- generic pastel dashboards
- heavy illustration in dense work views
- decorative clutter over data-heavy screens
- dark-mode-first styling
- purple default gradients

## Verification

For every upstream refresh and every visual pass:

```sh
pnpm --filter @paperclipai/ui typecheck
pnpm --filter @paperclipai/ui build
```

Before PR-ready handoff:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

Also run the app and check desktop and mobile widths.

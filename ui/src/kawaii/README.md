# Kawaii UI Layer

This directory is for fork-specific visual work.

Keep this layer narrow:

- Put theme variables and global visual overrides in `theme.css`.
- Put app-shell decoration in `KawaiiChrome.tsx`.
- Put shared animation constants in `motion.ts`.
- Put brand strings, motif names, and visual constants in `brand.ts`.

Prefer tokens and shared primitives before page rewrites.

Every page-level override should be listed here with the reason it could not stay token-only.

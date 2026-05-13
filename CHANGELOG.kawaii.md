# Paperclip Kawaii Changelog

## 2026-05-13

- Added the kawaii UI shell, route coverage, CEO/user presentation, Staff roster visuals, dialogue dock, and company-scoped kawaii display helpers.
- Added the finished character-in-scene visual workflow for Staff art, with bundled avatars, source references, and scene images for Rika, Sera, Yuna, and Nari.
- Added the `paperclip-kawaii` launcher, launchd support, upgrade helper flow, and static UI serving path.
- Hardened Kawaii shell asset loading so rendering the shell does not enqueue image generation and CEO assets stay scoped to the active company.
- Hardened the launcher so help flags are side-effect free and the default fork launch path starts from an available 3101+ port unless a port is explicitly configured.

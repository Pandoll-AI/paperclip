# Kawaii UI Principles

This document defines how the Paperclip Kawaii UI layer is applied across pages.
It is the guardrail for keeping the kawaii experience intact after upstream Paperclip updates.

## Scope

The Kawaii UI applies to company-scoped board pages under `/:companyPrefix/*`.

Default rule:
- A company page should render inside `KawaiiSidebar`, `KawaiiTopBar`, and `KawaiiDialogueDock`.
- A page may keep its legacy body temporarily, but the shell, CEO display, Staff labels, scene dialogue, and scroll behavior must stay kawaii.
- New company routes must be added to `routeLabels` in `ui/src/kawaii/KawaiiShell.tsx` and to `kawaiiScenes` in `ui/src/kawaii/sceneRegistry.ts`.

Explicit exceptions:
- Auth, invite, CLI auth, and board claim pages.
- Instance settings under `/instance/*`.
- Dev-only lab or performance test pages.
- Plugin-provided routes that require their own route sidebar.

## Current Coverage Audit

As of 2026-05-13:
- `Layout` applies the kawaii shell to company-scoped pages by default.
- Company Settings is included in the kawaii shell because it owns the CEO honorific setting.
- Instance settings remains outside the kawaii shell.
- Plugin routes with their own route sidebar remain outside the kawaii shell.
- Topbar labels cover the known first-party company routes in `App.tsx`.
- Bottom dialogue scenes cover the known first-party company route families in `sceneRegistry.ts`.
- Native kawaii bodies are implemented for the highest-signal pages first: Dashboard, Staff, and Approvals/Budget.
- Remaining first-party pages may still use legacy bodies, but they must appear inside the shell with the kawaii topbar, sidebar, and dialogue dock.

## Product Framing

Paperclip remains a control plane for AI-agent companies.
The kawaii layer changes presentation, not authority or safety semantics.

Display model:
- The user is the operator and is shown as `CEO, {username}`.
- The user/CEO avatar is always a faceless dotted outline.
- The CEO appears as an owner/operator card, not as a Staff roster member.
- Staff are AI agents and are shown as characters.
- Staff labels use only `{title}, {firstName}`.
- Backend or seeded agents with a CEO role are visually remapped to Staff roles such as CTO. The UI must not imply that an agent is the human user.

Authority model:
- The board/user approves governed actions.
- Staff may request, explain, warn, or recommend.
- The UI may use ceremonious service language, but not exaggerated royal address.
- Approval, budget, and safety copy must preserve the user's final control.

## CEO Honorific

The CEO honorific is company configuration.

Rules:
- The setting lives in Company Settings.
- The default is `대표님` for Korean locale and `Mr. CEO` otherwise.
- Dialogue and approval copy should call `kawaiiCeoHonorific(selectedCompany)`.
- Topbar identity should call `kawaiiCeoLabel(session)` and render `CEO, {username}`.
- Do not hardcode alternate honorifics in components.

Primary files:
- `ui/src/kawaii/display.ts`
- `ui/src/pages/CompanySettings.tsx`
- `ui/src/kawaii/useKawaiiScene.ts`

## Page Regions

Every kawaii company page is composed from these regions.

### Sidebar

Purpose:
- Company brand signal.
- Primary navigation.
- New Quest action.
- Staff roster preview.
- System status.

Display rules:
- Staff names use `kawaiiStaffLabel(agent)`.
- Staff avatars use `KawaiiAgentAvatar`.
- Generated Staff asset sets are preferred in both the full Staff Room and the sidebar preview.
- The CEO owner card sits outside the Staff roster and uses the faceless user outline.
- The Staff preview should show a small, scannable roster, not full detail.
- Active route styling should be obvious without breaking the soft visual tone.
- Mobile company pages must render the shared kawaii nav rail when the desktop sidebar is hidden.

### Topbar

Purpose:
- Current room title.
- Short operational subtitle.
- Notifications.
- CEO chip.

Display rules:
- Route title comes from `routeLabels`.
- Unknown company routes should use the generic `Paperclip Office` fallback, not a specific wrong room.
- CEO chip renders `CEO, {username}` plus the faceless user outline.
- The topbar must not use Staff art for the CEO.

### Main Body

Purpose:
- The actual work surface for each route.

Display rules:
- Native kawaii pages should use `kawaii-page`, `kawaii-panel`, `kawaii-card`, and related classes.
- Legacy bodies are allowed during migration, but only inside the kawaii shell and `KawaiiPageSurface`.
- Legacy pages should not introduce a second global sidebar, fixed footer, or body-level scroll.
- Cards are for repeated items, framed tools, or decision panels. Avoid decorative card stacking.

Native kawaii pages:
- Dashboard: `KawaiiOfficeDashboard`
- Staff: `KawaiiStaffRoom`
- Quests: `KawaiiQuestRoom`
- Projects: `KawaiiProjectStudio`
- Approvals and budget room: `KawaiiApprovalBudgetRoom`

Shell plus legacy body pages:
- Dashboard Live
- Company-prefixed onboarding
- Companies
- Company Settings, export, import, secrets
- Skills
- Plugins and adapter pages when not plugin-owned
- Org chart
- Agent create/detail pages
- Projects and workspaces
- Issues and issue detail
- Search
- Routines
- Execution workspaces
- Goals and goal detail
- Approval detail
- Costs
- Activity
- Inbox
- User profile
- Design guide
- Not found board page

### Bottom Message Area

Purpose:
- Persistent visual-novel style guidance.
- Route-aware Staff commentary.
- Lightweight action choices.
- Emotional continuity between legacy and native kawaii pages.

Display rules:
- The dock is `KawaiiDialogueDock`.
- Speaker label format is `{title}, {name}`.
- Message text comes from `useKawaiiScene`.
- Scene matching comes from `sceneRegistry.ts`.
- Text should use the CEO honorific when addressing the user.
- Choices are short operational options, not marketing copy.
- The character visual is a finished character-in-scene image.
- The dialogue scene image may occupy the lower-right UI edge, but must not block primary controls.
- Character head, hair, hands, legs, and feet must not be clipped or hollow.

### Avatars And Character Art

Purpose:
- Make each Staff member recognizable across the product.

Required assets for generated Staff sets:
- `avatar_square`: small roster and compact identity.
- `portrait_bust`: cards, side panels, and detail summaries.
- `portrait_full`: Staff room stage and large profile views.
- `scene_composite`: full character-in-scene image for large panels, staff detail, and dialogue dock.
- `scene_background_*`: visual-novel style route backgrounds.
- Reference metadata: traits, expressions, scenes, accessories, and moods.

Display rules:
- `KawaiiAgentAvatar` handles compact identity.
- `KawaiiPortrait` handles larger Staff presentation.
- Generated `scene_composite_*` assets should be preferred when ready.
- Local scene composites are the only bundled fallback for large character presentation.
- Loading states should shimmer or paint softly instead of showing broken images.
- The CEO/user outline is never replaced by a generated face.
- Approved source-character images live under `/kawaii/characters/sources/`.

### Character Scene Composite Contract

Purpose:
- Make every large character image a finished visual-novel scene.

Generation rules:
- Input is an approved source-character image.
- Output is one complete scene image containing both character and background.
- Canvas is `1536x1024` landscape.
- Character placement:
  - Character is on the right side.
  - Character center is at `76%` of canvas width.
  - Character height is `82-90%` of canvas height.
  - Head top is between `5-10%` of canvas height.
  - Feet are between `92-97%` of canvas height.
  - Right edge keeps at least `4%` canvas margin.
- UI-safe area:
  - Left `58%` of the canvas remains readable warm office atmosphere.
  - Bottom dialogue UI must remain legible over the image.
- Rejection rules:
  - Missing or hollow limbs.
  - Changed face identity.
  - Clipped head, hair, hands, legs, feet, or shoes.
  - Visible source-card border, hard rectangular paste edge, or unfinished background around the character.

### Generated Scene Backgrounds

Purpose:
- Keep the app from becoming a plain dashboard with character stickers.

Display rules:
- Dialogue-heavy pages should have a scene background candidate.
- Backgrounds must support readable UI layers.
- Generated scene background assets should be selected by `ownerType=scene`, `ownerId={scene.id}`, and `purpose=scene_background`.
- If generated scene assets are missing, pending, or failed, the UI must fall back to bundled local scene art.
- Do not start image generation during render. Use setup or explicit regenerate actions to enqueue jobs.
- Scenes should map to the user's current operational context:
  - Office for dashboard.
  - Staff Room for agents.
  - Quest Room for issues.
  - Strategy Room for goals.
  - Approval and Budget Room for approvals/costs.
  - Settings Atelier for company settings.
  - Project Studio for projects/workspaces.
  - Runtime Room for execution/routines/live dashboard.
  - Company Hall for company/org pages.
  - Tool Atelier for skills/plugins/search/import/export/profile/design guide.

## Scroll And Viewport

The outer app container must not scroll.

Rules:
- `.kawaii-shell` is fixed to `100dvh`.
- `.kawaii-board` is fixed to `100dvh`.
- `.kawaii-main` owns the full remaining viewport.
- `.kawaii-main__scroll` is the only vertical scroll container for page content.
- The bottom dialogue dock is positioned inside the kawaii shell and should not create body scroll.
- The mobile kawaii nav rail is part of the shell and must not create body-level scroll.
- Mobile layouts may stack the sidebar and content, but body-level scroll is still not allowed for kawaii shell pages.

## Data Integrity

Kawaii presentation must not fabricate operational metrics.

Rules:
- Dashboard, Staff, Quest, Project, Approval, and Budget numbers must come from API data or render an explicit empty state.
- Staff Room must not hardcode trust, skill, success, direct report, or goal values.
- Generated art loading may use local scene composites, but operational state must not use fallback fake values.

## Route Coverage Checklist

When adding or changing a route:

1. Confirm whether it is company-scoped.
2. If company-scoped, keep it inside the kawaii shell unless it is an explicit exception.
3. Add or update the topbar entry in `routeLabels`.
4. Add or update the dialogue scene in `sceneRegistry.ts`.
5. Ensure any Staff identity uses `kawaiiStaffLabel`.
6. Ensure CEO identity uses `kawaiiCeoLabel` or `kawaiiCeoHonorific`.
7. Confirm the bottom dialogue dock renders a non-clipped character-in-scene composite.
8. Confirm only `.kawaii-main__scroll` scrolls.
9. Check desktop and mobile screenshots.
10. Search for disallowed legacy honorific wording before handoff.

## Update Strategy

To keep this maintainable after upstream updates:
- Keep kawaii code isolated under `ui/src/kawaii`.
- Prefer wrapper components and display helpers over editing every legacy page.
- Replace high-value pages with native kawaii bodies gradually.
- Let legacy pages remain inside the kawaii shell until they are worth a full redesign.
- Keep generated image contracts in shared/server APIs instead of hardcoding image provider calls in React.
- Use local scene composite assets so the UI is complete before generated scene composites finish.

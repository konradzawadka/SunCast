# PLAN — Rename Editor flow to **SunCast** and make the code easier to understand

## Main objective

Improve code readability by making naming explicit, consistent, and product-aligned.

The main direction is:

* `EditorScreen` → `SunCastScreen`
* rename related files, components, hooks, and helpers in the same style
* reduce ambiguous “editor” naming where the code is really about the main SunCast app flow

This plan prioritizes **clarity of structure and naming** over deeper architectural changes.

---

## Refactor principle

Use **SunCast** as the top-level naming prefix for the main application flow.

That means:

* screens
* layout components
* panels
* controllers
* dev tools
* helpers tightly coupled to the main screen

should be renamed so a new developer can understand their role without reading implementation first.

---

## Phase 1 — Rename the main screen entry

### Goal

Replace the generic entry name with the real product flow name.

### Changes

* `EditorScreen.tsx` → `SunCastScreen.tsx`
* exported component `EditorScreen` → `SunCastScreen`

### Follow-up

Update all imports referencing:

* route wrappers
* tests
* screen composition modules
* any lazy imports

### Result

The main app screen immediately reflects product intent.

---

## Phase 2 — Rename direct editor submodules

### Goal

Rename all modules directly tied to `EditorScreen` into `SunCast*` naming.

### Target direction

Examples:

* `EditorLayout` → `SunCastLayout`
* `EditorSidebar` → `SunCastSidebar`
* `EditorCanvas` → `SunCastCanvas`
* `EditorTopbar` → `SunCastTopbar`
* `EditorTutorialController` → `SunCastTutorialController`
* `EditorDevTools` → `SunCastDevTools`

If such modules do not yet exist, use these names when extracting them.

### Rule

If a file is specific to the main screen flow, prefer `SunCast*`.
If a file is reusable across features, keep neutral naming.

### Result

----

A reader can identify “main app flow” code immediately.

Phase 2a — Split SunCastScreen into clear parts
Objective

Turn the editor from a large orchestration screen into smaller focused modules.

Proposed target structure

SunCastScreen

SunCastLayout

SunCastSidebar

SunCastCanvas

SunCastTopbar

SunCastTutorialController

SunCastDevTools (dev-only)

Tasks

Keep SunCastScreen as thin composition only.

Move sidebar/panel rendering to *Sidebar.

Move map container and view switching to *Canvas.

Move tutorial state orchestration to *TutorialController.

Move hidden import/debug shortcuts to *DevTools.

---

## Phase 3 — Rename panels and screen-specific UI for readability

### Goal

Make side panels and UI blocks self-explanatory.

### Renaming direction

Examples:

* `RoofPropertiesPanel` → keep if reusable
* `AnualDayProfilePanel` → `AnnualDayProfilePanel`
* any generic `ControlsPanel` tied only to this flow → `SunCastControlsPanel`
* any generic `Toolbar` tied only to this flow → `SunCastToolbar`

### Rule

Use `SunCast` prefix only where it improves clarity and for very central components.
Do not prefix low-level reusable UI components unnecessarily.

### Result

Screen-specific UI becomes easy to locate and distinguish from shared components.

---

## Phase 4 — Rename screen-coupled hooks and helpers

### Goal

Reduce ambiguity in supporting code.

### Renaming direction

Examples:

* `useRoofDebugSimulation` → `useRoofDebugSimulation` if kept
* hidden import helpers → `sunCastDebugImport*`
* screen-only keyboard handlers → `useKeyboardShortcuts`
* screen-only selection orchestration → `useSelectionState`

### Rule

If a hook/helper is only used by the main SunCast screen, name it that way.

### Result

It becomes obvious whether a hook is global, reusable, or screen-local.


---

## Phase 6 — Introduce naming boundaries

### Goal

Avoid renaming everything blindly.

### Rules

Use `SunCast*` for:

* main screen
* main-screen-only panels
* main-screen-only hooks
* main-screen-only helpers
* main-screen-only dev tools

Keep neutral names for:

* geometry math
* generic map utilities
* shared UI primitives
* reusable domain logic
* store utilities used across multiple app areas

### Examples

Keep neutral:

* `MapView`
* `fitPlane`
* `solveRoofPlane`
* `useProjectStore`

Rename if tightly screen-specific:

* `EditorScreen`
* `EditorTopbar`
* `EditorSidebar`
* `EditorTutorialController`

### Result

Naming becomes clearer without creating noise.

---

## Phase 7 — Remove legacy naming drift while renaming

### Goal

Use the rename pass to eliminate confusing leftovers.

### Tasks

1. Fix typos:

   * `AnualDayProfilePanel` → `AnnualDayProfilePanel`
2. Remove placeholder naming:

   * `AppName`
   * `Editor*` where no longer correct
3. Align product constants:

   * `appMetadata.appName = "SunCast"`

### Result

One cleanup pass improves readability everywhere.

---

## Phase 8 — Keep the app working during rename

### Goal

Make the rename safe and reviewable.

### Implementation order

1. Rename one file
2. Update exports
3. Update imports
4. Run tests/typecheck
5. Move to next layer

### Safe order

1. `EditorScreen` → `SunCastScreen`
2. direct imports of that screen
3. screen-local helpers/hooks
4. panels/components
5. filenames/folders
6. docs/readme references

### Result

Low-risk refactor with easy review.

---

## Phase 9 — Minimal structural cleanup after rename

### Goal

Readability first, without large architecture churn.

After rename, do only the most visible split:

* keep `SunCastScreen` thin
* move hidden debug/dev logic out
* move panel composition out if the file is still too large

### Suggested target

`SunCastScreen` should mainly:

* connect store state
* compose layout
* pass props to panels/map
* avoid inline debug orchestration

### Result

The renamed screen is also easier to read.

---

## Deliverable structure after refactor

Example target naming:

```text
src/
  features/
    sun-cast/
      SunCastScreen.tsx
      SunCastLayout.tsx
      SunCastSidebar.tsx
      SunCastCanvas.tsx
      SunCastTopbar.tsx
      SunCastTutorialController.tsx
      SunCastDevTools.tsx
      hooks/
        useSunCastKeyboardShortcuts.ts
        useSunCastSelectionState.ts
      components/
        SunCastAnnualDayProfilePanel.tsx
        SunCastControlsPanel.tsx
```

This is a direction, not a forced final structure.

---

## Recommended first batch

First rename only the most important and most understandable elements:

1. `EditorScreen.tsx` → `SunCastScreen.tsx`
2. `EditorScreen` export → `SunCastScreen`
3. route/import references
4. `AnualDayProfilePanel.tsx` → `SunCastAnnualDayProfilePanel.tsx`
5. screen-specific helpers/hooks using `Editor` naming

This gives immediate readability benefit.

---

## Expected benefits

* the main product flow is obvious from filenames
* less generic naming
* easier onboarding for new contributors
* easier navigation in IDE search
* reduced confusion between reusable code and screen-specific code

---

## Suggested next step after this plan

Prepare a concrete rename matrix: **old name → new name**, grouped by files, components, hooks, and folders.

Your best advisor Jacuś.

## Step 1

Extract only these parts from `useProjectStore.ts`:

* `projectState.types.ts`
* `projectState.storage.ts`
* keep reducer still inside `useProjectStore.ts`

## Why this step

It is low risk and gives immediate cleanup without changing behavior.

You remove from the main file:

* type noise
* localStorage read/write code
* JSON parse/stringify fallback logic
* storage keys/constants

So `useProjectStore.ts` becomes easier to scan, while the reducer and store API stay untouched.

## Scope

Move only:

### to `projectState.types.ts`

* `ProjectState`
* action union types
* stored-state types
* footprint-related store types

### to `projectState.storage.ts`

* storage key constant
* `readStorage()`
* `writeStorage()`

## Keep in `useProjectStore.ts`

* reducer
* initial state
* hook wiring
* dispatch/store composition

## Result after this step

You should get:

* smaller main store file
* cleaner imports
* easier next refactor step
* almost zero regression risk

## Next step after that

Only then extract:

* `sanitizeLoadedState`
* `toStoredFootprint` / `fromStoredFootprint`

That would be the second safe win.

Step 2

Extract only data cleanup and persistence mapping:

projectState.sanitize.ts

projectState.mappers.ts

Why this is the next best step

After storage is moved out, the next biggest noise is usually:

loaded state validation

fallback/default repair

conversion between runtime footprint and stored footprint

This logic is often pure, easy to move, and easy to test.

Scope
to projectState.sanitize.ts

Move:

sanitizeLoadedState(...)

small helper validators used only for loaded state repair

defaulting logic for missing or broken fields

to projectState.mappers.ts

Move:

toStoredFootprint(...)

fromStoredFootprint(...)

any tiny helper used only for store/runtime conversion

Keep in useProjectStore.ts

Still keep:

reducer

hook setup

initial state

store composition

dispatch-facing API

Result after this step

You get:

store file focused mostly on runtime behavior

persistence path much clearer: read -> sanitize -> map -> use

easier debugging when localStorage has broken data

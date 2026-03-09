# Pitch adjustment in Status panel

### Goal

User can apply a **percentage pitch adjustment** from the **Status** panel, so the app shows an **adjusted pitch** derived from the solved roof pitch and lets the user quickly increase or decrease it without changing the raw height constraints.

### Why

Right now the app already computes and shows `Pitch: X deg` in `StatusPanel`.
Sometimes the solved plane is close but the user wants a quick correction like `+5%` or `-10%` without re-editing vertex heights or just check how system will behave in other conditions.

---

## Scope rules

* Adjustment is available only when the active roof has a solved pitch.
* Adjustment is entered as **percent**, not degrees.
* Adjustment affects the **displayed / derived pitch used by status-driven features**, not the stored vertex/edge constraints.
* Base pitch remains visible, so user can compare:

  * **Base pitch**
  * **Adjustment %**
  * **Adjusted pitch**
* Negative adjustment is allowed.
* When no solved pitch exists, control is disabled or hidden.

---

## User story

As a user,
I want to adjust the solved roof pitch by a percentage in the Status panel,
so that I can quickly fine-tune the pitch up or down without changing my roof geometry inputs.

---

## Functional behavior

### 1) New status control

Add a small control block in `StatusPanel` near the current pitch row:

* `Base pitch: 34.20 deg`
* `Pitch adjustment: [ -10 ] %`
* `Adjusted pitch: 30.78 deg`

### 2) Adjustment formula

Use solved pitch as base:

`adjustedPitchDeg = basePitchDeg * (1 + adjustmentPercent / 100)`

Examples:

* base `30 deg`, adjustment `+10%` → `33 deg`
* base `30 deg`, adjustment `-10%` → `27 deg`

### 3) Input behavior

* Default value: `0%`
* User can type positive or negative number
* Decimal values allowed
* Empty / invalid input falls back to last valid value or `0`
* Optional clamp for safety, for example `-90%` to `+200%`

### 4) Status presentation

When solved pitch exists, show:

* `Pitch: 34.20 deg`
* `Pitch adjustment: +0.0 %`
* `Adjusted pitch: 35.91 deg`

If adjustment is `0`, adjusted pitch still matches base pitch.

### 5) Data model

Persist pitch adjustment per active footprint/project state, so switching footprints keeps separate adjustment values.

Suggested field shape:

* per footprint or active roof config:

  * `pitchAdjustmentPercent: number`

### 6) Feature impact

Any feature that explicitly uses roof pitch from “status-adjusted” flow should consume `adjustedPitchDeg`, not raw solved pitch.

At minimum:

* Status display uses adjusted pitch
* Any next feature based on manual status pitch should read adjusted pitch consistently

Raw solver metrics must still remain available internally as original values.

---

## Acceptance criteria

* When a roof is solved, user sees a percentage input in Status.
* When user enters `+10`, adjusted pitch updates immediately.
* When user enters `-10`, adjusted pitch decreases immediately.
* Raw vertex and edge constraints do not change.
* Base pitch is still visible.
* Invalid input does not break the panel.
* Adjustment is retained for the footprint/project after rerender or selection change.

---

## Notes for current codebase

This fits naturally into current structure:

* `StatusPanel.tsx` already renders `pitchDeg`
* `useSunCastController.ts` already prepares sidebar status values
* store can keep `pitchAdjustmentPercent`
* controller can expose both:

  * `basePitchDeg`
  * `pitchAdjustmentPercent`
  * `adjustedPitchDeg`

A clean direction is to stop overloading current `pitchDeg` and expose explicit fields instead.

---

## Suggested UI text

* `Base pitch`
* `Pitch adjustment (%)`
* `Adjusted pitch`


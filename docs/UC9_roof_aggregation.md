## PLAN — multi-selection of polygons with aggregated charts

### Goal

Enable multi-selection for all polygons in the editor.
When one or more polygons are selected, charts in `SunOverlayColumn.tsx` should show **one aggregated result** as a simple sum of all selected polygons.
When nothing is selected, show **no chart**.

---

### 1. Selection model

Introduce shared editor selection state for polygons:

* single click without modifier: select one polygon
* `Ctrl + click`: toggle polygon in selection
* `Ctrl + A`: select all polygons
* selection applies to whole editor, not only charts

Suggested shape:

* `selectedPolygonIds: string[]` or `Set<string>`
* helpers:

  * `isSelected(id)`
  * `toggleSelected(id)`
  * `selectOnly(id)`
  * `selectAll()`
  * `clearSelection()`

---

### 2. Editor interaction rules

Implement consistent interaction rules:

* plain click on polygon:

  * clears previous selection
  * selects clicked polygon only
* `Ctrl + click` on polygon:

  * adds polygon if not selected
  * removes polygon if already selected
* click on empty space:

  * clears selection
* `Ctrl + A`:

  * selects all polygons currently available in editor

This selection should be visually reflected across the whole editor.

---

### 3. Visual selected state

All selected polygons should be clearly visible in editor UI.

Suggested selected indicators:

* stronger border
* highlight handles
* selected overlay tint
* selected label / badge if already present in editor style

Need one visual language for:

* single selected polygon
* multiple selected polygons

---

### 4. Data source for charts

`SunOverlayColumn.tsx` should no longer calculate per polygon independently for display.

New behavior:

* read selected polygons from shared editor state
* if `selectedPolygonIds.length === 0` → render nothing
* if one or more polygons selected → calculate each separately, then sum into one merged chart series

This applies to:

* daily chart
* annual aggregated day profile chart
* any similar sun/irradiance chart in this column

---

### 5. Aggregation rule

Aggregation is a **plain sum**, not area-weighted.

For every selected polygon:

* compute its own chart series using:

  * its own geometry
  * its own pitch
  * its own azimuth
* merge by matching time bucket

For each time bucket:

* `total = sum(series[i].value for all selected polygons)`

---

### 6. Shared time bucket contract

To make summation deterministic, all chart generators must use the same bucket system.

For example:

* daylight daily chart: same sampling as current implementation
* annual chart: fixed `15 min` buckets

Each per-polygon calculation should return:

* `minuteOfDay`
* `value`

Then merged result is built by identical `minuteOfDay`.

---

### 7. Per-polygon calculation reuse

Keep current single-polygon logic intact, but extract it into reusable functions.

Suggested utilities:

* `getPolygonDailySunProfile(...)`
* `getPolygonAnnualAggregatedProfile(...)`

Then add aggregation helpers:

* `sumProfiles(profiles)`
* `getSelectedPolygonsDailyProfile(...)`
* `getSelectedPolygonsAnnualProfile(...)`

This preserves current behavior for one polygon and extends naturally to many.

---

### 8. Single-selection compatibility

When exactly one polygon is selected:

* chart behavior should remain the same as today
* output should match existing chart logic
* only data flow changes to pass through aggregation pipeline

So:

* single selection = existing result
* multi selection = summed result
* no selection = no chart

---

### 9. Keyboard support

Add keyboard shortcut handling for:

* `Ctrl + A` → select all polygons

Recommended:

* only active when editor canvas/focus context is active
* prevent unwanted browser/editor conflicts where needed

Do not add more shortcuts unless needed now.

---

### 10. Chart visibility rules

In `SunOverlayColumn.tsx`:

* no selected polygons → no daily chart, no annual chart
* 1+ selected polygons → show charts
* charts are derived only from selected polygons

Optional small label:

* `Selected polygons: N`

But not required for MVP.

---

### 11. State flow

Recommended state architecture:

* selection state lives in editor-level shared store/context
* polygon components read selected state for rendering
* `SunOverlayColumn.tsx` reads selected polygon ids and polygon definitions from same store

This avoids local selection duplication and keeps charts synchronized with editor interactions.

---

### 12. Recompute triggers

Charts should recompute when any of these change:

* selection set changes
* polygon geometry changes
* polygon pitch changes
* polygon azimuth changes
* location changes
* selected datetime/year changes
* sampling mode changes

Wrap expensive aggregations in memoized selectors.

---

### 13. Empty and invalid cases

Handle safely:

* no selection → render nothing
* selected polygon missing required roof params → skip it or show empty state
* all selected polygons invalid → no chart
* deleted polygon that was selected → remove from selection automatically

---

### 14. Suggested implementation order

1. Add shared multi-selection state for all polygons
2. Implement `Ctrl + click` toggle selection
3. Implement `Ctrl + A` select all
4. Add selected styling in editor
5. Extract existing single-polygon chart calculation utilities
6. Add sum aggregation helpers
7. Connect `SunOverlayColumn.tsx` to selected polygons only
8. Make no-selection hide charts
9. Verify single-selection parity with current behavior
10. Verify multi-selection aggregation

---

### 15. Acceptance criteria

Done when:

1. User can select one polygon by click.
2. User can multi-select polygons with `Ctrl + click`.
3. User can select all polygons with `Ctrl + A`.
4. Selected state is visible across whole editor.
5. When no polygon is selected, charts are hidden.
6. When one polygon is selected, charts behave like today.
7. When many polygons are selected, charts show one combined summed result.
8. Each selected polygon uses its own pitch and azimuth.
9. Changing selection immediately updates charts.
10. Deleting or editing selected polygons updates charts and selection state correctly.

---

### 16. Nice follow-up later

Later you may add:

* selection badge count
* clear selection button
* select by group/layer
* list of selected polygon ids
* alternative aggregation modes


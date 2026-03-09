

---

## UC Extension — Hidden Polygon Config Injection

### Goal

Allow fast developer/test setup by injecting multiple polygons with height constraints from JSON.

This is a hidden tool and does not replace normal drawing/editing flow.

---

### Behavior

1. User presses `Ctrl + Shift + I` in editor.
2. Hidden panel appears with JSON textarea and `Inject Polygons` button.
3. User pastes array of entries:

```json
[
  {
    "footprintId": "fp-1",
    "polygon": [[20.8670, 52.1789], [20.8669, 52.1787], [20.8671, 52.1788]],
    "vertexHeights": [
      { "vertexIndex": 0, "heightM": 9 },
      { "vertexIndex": 1, "heightM": 9 },
      { "vertexIndex": 2, "heightM": 6.5 }
    ]
  }
]
```

4. App validates and upserts entries by `footprintId`.
5. Imported polygons become selected; last imported polygon becomes active.
6. Solver/meshes/charts update from injected geometry and constraints.

---

### Validation rules

Reject entry if:

* `footprintId` missing/empty
* `polygon` has fewer than 3 valid `[lon, lat]` points

Ignore invalid constraint rows where:

* `vertexIndex` is not integer
* `heightM` is not finite
* `vertexIndex` outside polygon range (sanitized)

If all entries are invalid, show parser/import error.

---

### State and persistence

* Injection writes to the same project store used by drawing tools.
* Data is persisted in `localStorage["suncast_project"]`.
* Reloading app restores identical injected footprints and constraints.

---

### Debug API (optional)

For automated/debug flows:

```js
window.suncastDebug.importPolygonsAndHeights(rawJsonString)
```

---

### Acceptance criteria

Done when:

1. Hidden panel is not visible by default.
2. `Ctrl + Shift + I` toggles panel visibility.
3. Valid JSON array injects polygons and vertex heights.
4. Existing footprint with same `footprintId` is replaced (upsert behavior).
5. Imported footprints are selected and active footprint is updated to last imported.
6. Invalid JSON/shape shows error and does not corrupt existing state.
7. Reload keeps injected data and deterministic solver output.

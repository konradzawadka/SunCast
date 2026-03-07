## UC — Multiple Footprints stored in browser

### Goal

User can create and manage **multiple building footprints**.
All footprints are **persisted in browser storage** so the project survives page reload.

---

# Behavior

### Create footprint

User draws polygon.

System:

* generates `footprintId`
* creates empty roof model
* stores in browser

Result:

```
Project
 ├ footprint_1
 ├ footprint_2
 ├ footprint_3
```

---

### Load on startup

On app load:

```
localStorage → load project JSON
```

Render:

* all footprints
* vertex constraints
* solved planes (if valid)

---

### Active footprint

Only **one footprint is editable at a time**.

When user clicks footprint:

```
activeFootprintId = clickedId
```

Editor actions apply only to active footprint.

---

### Delete footprint

User selects footprint → delete.

System removes:

```
footprint
vertex heights
roof surface
```

and updates storage.

---

### Data model

```
Project
  footprints: {
     [footprintId]: Footprint
  }

Footprint
  id
  polygon: [vertices]
  vertexHeights: { vertexId → height }
```

Optional derived data (not persisted):

```
plane
roof mesh
```

---

# Storage format

Persist single JSON object.

```
localStorage["suncast_project"]
```

Example:

```
{
  footprints: {
    "fp1": {
       polygon: [[lon,lat], ...],
       vertexHeights: {
         "v1": 3,
         "v2": 3,
         "v3": 4
       }
    },
    "fp2": {
       polygon: [[lon,lat], ...],
       vertexHeights: {}
    }
  }
}
```

---

# Acceptance criteria

User can:

* create many footprints
* reload page → footprints still exist
* select footprint and edit its vertices
* delete footprint

---

# Questions

1. Should **each footprint represent a separate building**, or can a building have **multiple roof faces across footprints**?

2. When user draws new polygon:

   * should it automatically become **active footprint**?

3. Do you want **renaming footprints** (ex: “Building A”) or IDs only?

4. Should we allow **export/import project JSON** already in this UC?

5. Max expected number of footprints:

   * <10
   * <100
   * > 100
     > (affects storage and rendering strategy)


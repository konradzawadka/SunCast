## UC — Edge height is helper for vertex heights

### Rules (locked)

* **Vertex height is the only source of truth.**
* **Edge height edit = set both endpoint vertices to that height.**
* If vertex already has height and edge edit happens → **edge edit overwrites vertex**.
* If multiple edits happen → **last change wins**.
* Plane solver accepts **exactly 3 vertices with heights**.
* If **>3 vertices have heights → overconstraint error**.

---

# Implementation Plan

## 1. Data model simplification

Persist only vertex heights.

```
FootprintPolygon
  vertices: [{id, lon, lat}]

RoofSurface
  vertexHeights: {
    [vertexId]: z_m
  }
```

Edges are **derived**:

```
edgeId = (vertexIdA, vertexIdB)
```

Edge has **no stored height**.

---

# 2. Editor selection behavior

### Vertex selection

User clicks vertex:

* highlight vertex
* open **height input**
* focus input automatically
* saving writes:

```
vertexHeights[vertexId] = z
```

---

### Edge selection

User clicks edge:

* highlight edge
* highlight both vertices
* open **height input**
* focus input automatically

Saving performs:

```
vertexHeights[vA] = z
vertexHeights[vB] = z
```

Edge is just a **shortcut to update two vertices**.

---

# 3. Overconstraint validation

After each edit:

```
numConstrained = count(vertexHeights)
```

Rules:

| count | behavior                      |
| ----- | ----------------------------- |
| <3    | plane not solvable yet        |
| =3    | solve plane                   |
| >3    | show **overconstraint error** |

Error UX:

* highlight constrained vertices
* message:

```
Plane requires exactly 3 vertex heights.
Remove one constraint.
```

---

# 4. Solver input

Solver receives:

```
constrainedVertices = [
 {x,y,z},
 {x,y,z},
 {x,y,z}
]
```

Solve plane:

```
z = p*x + q*y + r
```

Then compute Z for **all footprint vertices**.

---

# 5. Visual feedback

### Vertex markers

Display height label:

```
3.4 m
```

### Edge helper display

If both endpoints share height:

```
edge label = same height
```

If heights differ:

```
no edge label
```

---

# 6. Interaction polish

When user clicks:

| click target | action                      |
| ------------ | --------------------------- |
| vertex       | select vertex + focus input |
| edge         | select edge + focus input   |
| map          | clear selection             |

---

# 7. Acceptance criteria

Edge edit:

```
user clicks edge
enter 3m
→ both vertices become 3m
```

Vertex overwrite:

```
v1 = 4m
edge edit = 3m
→ v1 becomes 3m
```

Overconstraint:

```
4 vertices set
→ error displayed
→ solver disabled
```

---


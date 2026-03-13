## Bug: Sun access counts hours when the sun is behind the roof plane

**Severity:** High
**Type:** Logic bug / simulation correctness
**Area:** Shading, annual sun access, live roof illumination

### Summary

The application currently counts some time steps as valid sun access even when the sun is no longer hitting the front side of the roof plane.

This causes **sun access hours** and related ratios to be overstated.

---

### Problem

The current logic appears to treat a roof cell as sunlit when:

* the sun is above horizon,
* the sun is above the low-sun threshold,
* the cell is not blocked by an obstacle.

That is incomplete.

A roof plane should only receive direct sun when the sun direction is still on the **front side** of the plane. Once the sun passes the plane angle and is effectively behind the roof surface, that time step should **not** be counted as sun access.

---

### Expected behavior

A time step should be counted as direct roof sun access only if all of the following are true:

1. the sun is above horizon,
2. the sun is above the configured low-sun threshold,
3. the sun is on the **front side of the roof plane**,
4. the point/cell is not shaded by an obstacle.

For condition 3, the plane normal must still face the sun direction:

* `dot(roofNormal, sunDirection) > epsilon`

If this value is zero or negative, the roof should not be reported as receiving direct sun.

---

### Actual behavior

The current logic appears to count non-shaded daylight as sun access even when the roof plane is no longer sun-facing.

As a result:

* annual sun access hours are overstated,
* annual sun access ratio is semantically wrong,
* live shading/illumination can also mark cells as lit when the sun is actually behind the plane.

---

### Impact

This affects the correctness of the core product output.

Possible consequences:

* roofs report too many “sun hours”,
* north-facing or poorly oriented planes can look better than they should,
* annual comparisons between roofs become misleading,
* UI labels suggest “direct sun access” while the logic is closer to “unobstructed daylight above horizon”.

This is not a cosmetic issue. It is a model correctness issue.

---

### Suspected root cause

The shading/sun-access pipeline appears to check:

* sun above horizon,
* minimum altitude threshold,
* obstacle occlusion,

but does **not** consistently check whether the sun is still on the front side of the roof plane.

There is likely already plane-incidence logic elsewhere in the codebase, but it is not being applied consistently in the sun-access calculation path.

---

### Reproduction idea

Use a single roof plane with known tilt and azimuth, no obstacles.

Example scenario:

* create one roof plane,
* choose a sun position where the sun is above horizon,
* but already behind the plane relative to the roof normal,
* run live shading / annual sun access.

**Observed:** the step may still be counted as sun access.
**Expected:** it should count as zero direct sun access for that plane.

---

### Correct fix

Introduce a roof-facing check before counting any direct illumination.

For each roof/time step:

* compute roof normal,
* compute sun direction,
* compute `cosIncidence = dot(roofNormal, sunDirection)`

Rules:

* if `cosIncidence <= epsilon`, the roof is **not sun-facing**
* that step must **not** increase direct sun access hours
* that step must **not** be treated as lit in the direct-sun model

Recommended small tolerance:

* `epsilon = 0.01` or similar

---

### Fix plan

#### 1. Add explicit front-side illumination check

Create shared logic for:

* roof normal
* sun direction
* incidence / front-side test

#### 2. Apply it in live shading

Update the live shading path so a roof cell cannot be marked as lit when the roof is not sun-facing.

#### 3. Apply it in annual sun access

Split annual metrics into clearer categories:

* `skyDaylightHours`
* `frontSideHours`
* `unshadedFrontSideHours`

Then compute:

* `sunAccessRatio = unshadedFrontSideHours / frontSideHours`

Do not use generic daylight hours as the denominator for direct roof sun access.

#### 4. Review UI wording

If needed, rename labels so they match the actual physics/model.

---

### Acceptance criteria

* a roof receives direct sun only when `dot(roofNormal, sunDirection) > epsilon`
* roofs facing away from the sun are not counted as sunlit
* annual sun access excludes non-front-side daylight
* live shading distinguishes between:

  * sun-facing and lit
  * sun-facing but shaded
  * not sun-facing

---

### One-line judgment

The current implementation overcounts direct roof sun because it checks for daylight and obstacle shade, but not whether the roof plane is still facing the sun.

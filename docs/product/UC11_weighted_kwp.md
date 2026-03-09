## Story — weighted polygons for estimated PV charts

**Title**
Use polygon weights to build weighted estimated PV charts

**User story**
As a user, I want each polygon to carry its own weight in the PV estimation model, so that charts show a combined result where every selected polygon influences the output proportionally to its assigned contribution.

**Context**
Today the chart direction was moving toward simple summation of selected polygons.
This story changes that emphasis: the main idea is now **weighted aggregation**.

That means:

* each polygon has its own geometry and roof parameters
* each polygon also has its own assigned contribution factor
* combined charts are calculated from all selected polygons using their weights
* charts should better reflect that some polygons represent larger or more important PV areas than others

---

## Functional intent

For selected polygons:

1. calculate estimated PV profile for each polygon independently
2. apply polygon weight to that profile
3. aggregate all weighted profiles into one final chart

So final chart is not only:

* “selected polygons added together”

but rather:

* “selected polygons contribute according to their configured weight”

---

## Weight meaning

For MVP, polygon weight should represent installed PV contribution for that polygon.

Most practical form:

* **polygon `kWp` acts as the weight**

So:

* profile shape comes from polygon geometry, pitch, azimuth, solar model
* profile amplitude comes from polygon `kWp`
* final result is weighted aggregation of selected polygons

This makes the charts:

* geometry-aware
* capacity-aware
* naturally weighted

---

## Expected behavior

* every polygon stores its own `kWp`
* user edits `kWp` on the active polygon
* charts use only selected polygons
* polygons with higher `kWp` contribute more strongly
* polygons with `kWp = 0` contribute nothing
* when one polygon is selected, chart reflects only its weighted result
* when many polygons are selected, chart reflects weighted aggregation of all of them
* when nothing is selected, no chart is shown

---

## What “weighted” means mathematically

For every selected polygon and each time bucket:

`weightedValue = normalizedPolygonProfile * polygonKwp`

Then:

`finalChartValue = sum(weightedValue of all selected polygons)`

So weight is not an extra cosmetic multiplier.
It is the core way the polygon contributes to total estimated output.

---

## Scope

This story covers:

* polygon-level `kWp`
* weighted aggregation of selected polygons
* daily estimated PV chart in `SunOverlayColumn.tsx`
* separate annual aggregated chart using the same weighting logic
* multi-selection behavior already agreed in editor

This story does **not** include:

* forecast API
* inverter clipping
* loss modeling
* shading
* bulk `kWp` editing
* historical data migration

---

## Acceptance criteria

1. Each polygon can store its own `kWp`.
2. `kWp` is editable for the active polygon.
3. Selected polygons are aggregated using weighted contribution, where `kWp` is the weight.
4. Polygon with larger `kWp` contributes proportionally more to the final chart.
5. Polygon with `kWp = 0` contributes zero.
6. One selected polygon shows its own weighted estimated profile.
7. Multiple selected polygons show one combined weighted estimated profile.
8. No selected polygons means no chart.
9. Daily chart and annual aggregated chart both use the same weighting concept.
10. Each polygon keeps its own pitch, azimuth, and solved geometry.

---

## Short implementation direction

* treat `kWp` as polygon weight
* compute per-polygon normalized solar profile
* multiply by `kWp`
* sum weighted series across selected polygons
* render one combined chart


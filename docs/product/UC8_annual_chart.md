## PLAN — annual aggregated day-profile chart in `SunOverlayColumn.tsx`

### Goal

Add a new chart in `SunOverlayColumn.tsx` that shows an **annual aggregated daylight irradiance profile**:

* same idea as `SunDailyChartPanel`
* but instead of one selected date, compute and sum values across **365 days**
* result is one synthetic day curve
* sampling can be **15 min**
* daylight-only logic stays aligned with current daily chart behavior
* pure calculation, no forecast API

---

### 1. Define chart meaning precisely

Implement chart as:

`annualAggregatedDaylightIrradianceProfile`

Meaning:

* for each time slot in the day, for example every 15 min
* calculate roof-plane irradiance for each day of the year
* sum irradiance from all 365 days into that slot
* render final curve as one “typical annual accumulation by time of day”

Example:

* 10:30 slot = sum of all 10:30 irradiance values from Jan 1 to Dec 31
* 14:15 slot = sum of all 14:15 irradiance values from Jan 1 to Dec 31

Output unit:

* likely still aggregated irradiance-like value, effectively `W/m²-sum over days`
* for UI label, better name it clearly, not just `W/m²`

---

### 2. Reuse same solar model family as daily chart

Ensure calculations use the same conventions as existing daily sun chart logic:

* solar position
* sun altitude / azimuth
* incidence on roof plane
* clear-sky / geometric irradiance assumptions already used by `SunDailyChartPanel`

Do not introduce another method family.

---

### 3. Create calculation utility

Add a dedicated utility, for example:

`getAnnualAggregatedDayProfile({ year, tz, lat, lon, roofPlane, stepMinutes })`

Responsibilities:

* iterate over all days in selected year
* iterate over time slots for each day
* compute irradiance for the roof plane
* ignore non-daylight samples
* accumulate values into shared time buckets
* return chart-ready series

Suggested return:

* `points: Array<{ timeLabel, minuteOfDay, value }>`
* `meta: { year, stepMinutes, dayCount, nonZeroBuckets }`

---

### 4. Year selection rule

Decide source year from current selected datetime:

* if user selected a datetime, use its year
* if absent, use current local year

This keeps chart deterministic and aligned with UI state.

---

### 5. Time bucket model

Use fixed time buckets:

* `00:00` to `23:45`
* step `15 min`

For each bucket:

* store accumulated value
* optionally store contributing sample count for debugging only

Night buckets can remain absent from final rendered series if current daily chart hides them similarly.

---

### 6. Daylight filtering

For each day:

* compute sunrise/sunset or equivalent daylight condition
* only evaluate / accumulate daylight samples
* skip night samples entirely

This preserves same shape philosophy as `SunDailyChartPanel`.

---

### 7. Chart rendering in `SunOverlayColumn.tsx`

Add a new chart block, separate from current daily one.

Suggested behavior:

* render below current daily chart
* title example: `Annual Day Profile`
* same charting library / visual style as `SunDailyChartPanel`
* same axis style where possible

Axes:

* X: time of day
* Y: annual accumulated irradiance

---

### 8. Labels and copy

Avoid misleading wording like “daily forecast”.

Use labels closer to:

* `Annual aggregated day profile`
* `Accumulated roof irradiance by time of day`
* `Calculated from all days in selected year`

This matters because values are no longer a single-day irradiance curve.

---

### 9. Performance strategy

Naive full-year calculation at 15-min resolution is still manageable:

* `365 * 96 = 35,040` samples per year

This is lightweight in browser if math is simple. But you can count it not for all days but pickup 1 day in 5 days window.

Still:

* wrap computation in `useMemo`
* recompute only when these change:

  * year
  * lat/lon
  * roof pitch
  * roof azimuth
  * stepMinutes
  * calculation mode assumptions

---

### 10. Shared config with daily chart

Extract common chart config if duplicated:

* axis formatting
* tooltip formatting
* daylight domain trimming
* empty/loading states
* unit label formatting

This reduces divergence between charts.

---

### 11. Empty/error handling

Show empty state when:

* missing location
* missing roof geometry
* invalid numeric input
* polar edge cases with no meaningful daylight profile

No API loading state needed, since chart is computed locally.

---

### 12. Acceptance checks

Implementation is done when:

* new chart appears in `SunOverlayColumn.tsx`
* chart uses pure calculation, no remote API
* chart aggregates all days of selected year
* chart uses daylight-only samples
* chart shape is consistent with roof pitch/azimuth changes
* changing year changes output
* chart stays visually aligned with `SunDailyChartPanel`

---

### 13. Suggested implementation order

1. Extract/reuse core irradiance calculation from daily chart
2. Build annual aggregation utility
3. Unit-test bucket generation and accumulation
4. Add chart section in `SunOverlayColumn.tsx`
5. Reuse daily chart styling
6. Verify with known roof orientations:

   * south
   * east
   * west
   * flat roof

---

### 14. Nice-to-have later

Not for now:

* normalize to average day instead of annual sum
* compare two roof planes
* overlay solstice/equinox markers
* switch between `sum` and `mean`
* export data

If you want, I can now rewrite this as a proper implementation story with dev tasks and acceptance criteria.


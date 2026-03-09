
* Sampling: **15 min**
* Window: **sunrise → sunset** (no night points)
* Series: **POA total only** (clear-sky) in **W/m²**

---

## Updated plan

### 1) Daily time window

Implement `getSunriseSunset({date, tz, lat, lon}) -> { sunriseTs, sunsetTs }`

* Use same solar-position library/method family as UC5 to avoid convention drift.
* Clamp edge cases (polar day/night):

  * if no sunrise/sunset: show “No sunrise/sunset for this date at this latitude” and no chart.

### 2) Series generator (15-min)

`getDailyPoaSeries({ date, tz, lat, lon, roofPlane, stepMinutes: 15 })`

* `t = sunriseTs` to `sunsetTs` inclusive, step 15 min
* For each `t`:

  * compute sun az/el
  * compute incidence on roof plane
  * clear-sky DNI/DHI
  * `poa = poaDirect + poaDiffuse` (total only)
* Return:

  * `labels[]` as `HH:mm`
  * `values[]` as `number` (W/m²)

### 3) UI story (Chart.js)

Component: `SunDailyChartPanel`

* Inputs:

  * date picker (mandatory)
  * shows computed sunrise/sunset times (small text)
* Output:

  * Chart.js line chart (single dataset: `POA (clear-sky) W/m²`)
  * Summary:

    * `Peak: {max} W/m² at {time}`
    * `Window: {sunrise}–{sunset} ({count} points, 15 min)`

### 4) Caching / stability

* `useMemo` keyed by `{date,tz,lat,lon,roofParams}`
* Ensure labels strictly increasing; no duplicates (DST-safe by generating via “add minutes” in tz).

### 5) Acceptance criteria

* Chart renders only when:

  * roof plane solved
  * location available
  * date selected
* Points count equals `floor((sunset - sunrise)/15min)+1` (or +0 if you decide exclusive end; pick inclusive in code and tests).
* All values are `>= 0` and finite.
* Changing date updates sunrise/sunset + curve + peak.

### 6) Tests

Unit:

* fixed inputs produce deterministic `sunrise/sunset` and series length
* all values finite, `>= 0`
  Playwright:
* set date → chart appears + peak text visible
* change date → peak text changes 


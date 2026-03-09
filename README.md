
# SunCast - Solar Estimator and Short Time Forecast

Interactive web application for **modeling roof geometry and estimating photovoltaic production** based on:

* roof polygon footprint
* vertex heights (roof slope)
* orientation and pitch
* installed PV capacity (kWp)
* solar position calculations

The app allows users to draw roofs, configure geometry, and visualize **estimated PV output over the day and year**.

Live demo: [SunCast Demo](https://konradzawadka.github.io/SunCast/)

---

# Main Features

### Roof modeling

* draw roof polygons on the map
* edit vertex positions
* define vertex heights to determine roof pitch
* view the roof in **orbit / 3D perspective**

### PV estimation

* assign **kWp** capacity to each roof polygon
* compute **daily solar output profile**
* compute **annual aggregated production profile**

### Multi-polygon support

* multiple roof sections can be modeled
* charts aggregate selected polygons
* each polygon contributes based on its own geometry and kWp

### Visualization

* orbit camera view for roof inspection
* solar irradiance calculations
* Chart.js charts for PV output estimation

---

# Tech Stack

Frontend:

* **React**
* **TypeScript**
* **Vite**
* **Chart.js**
* **Playwright** for E2E testing

Architecture concepts:

* geometry-first solver model
* deterministic clear-sky estimation (local computation)
* weather-based short-term forecast (Open-Meteo API)

---

# Requirements

Install:

* **Node.js ≥ 18**
* **npm ≥ 9**

Verify:

```bash
node -v
npm -v
```

---

# Install

Clone repository and install dependencies.

```bash
git clone <repo-url>
cd <project-folder>
npm install
```

---

# Run locally

Start development server:

```bash
npm run dev
```

Vite will start the application:

```
http://localhost:5173
```

Hot reload is enabled.

---

# Build

Create production build:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

---

# Tests

### Unit tests

```bash
npm run test
```

### End-to-end tests

```bash
npm run test:e2e
```

### E2E coverage

```bash
npm run coverage:e2e
```

Playwright tests run the full application in a browser and validate user workflows.

---

# Basic Workflow in the App

Typical usage flow:

1. **Draw roof polygon**

   * click on map to add vertices
   * minimum 3 vertices required

2. **Finish polygon**

   * click *Finish* once the last vertex is placed

3. **Set installed PV capacity**

   * enter `kWp` for the roof

4. **Define roof heights**

   * set heights for at least three vertices
   * roof pitch is calculated automatically

5. **Inspect roof**

   * switch to **orbit view**
   * verify roof orientation and slope visually

6. **View PV charts**

   * daily PV production estimate
   * annual aggregated PV production profile

7. **Navigate sun date quickly**

   * in **Sun Date & Time**, use arrow keys to change date by 1 day
   * `↓` = next day, `↑` = previous day
   * `Shift + ↑` = +1 hour, `Shift + ↓` = -1 hour

8. **Useful shortcuts**

   * `Escape` while drawing cancels active drawing
   * `Shift` while drawing temporarily disables right-angle snap
   * `Ctrl/Cmd + A` selects all footprints (when not focused in an input)

9. **Use tutorial onboarding**

   * click `?` in sidebar title row to open quick guide + shortcuts
   * click **Start interactive tutorial** to run spotlight walkthrough

---

# Project Structure

Simplified structure:

```text
src/
  app/
    components/
      MapView/
      DrawTools/
      RoofEditor/
      SunOverlayColumn.tsx
      SunDailyChartPanel.tsx
      ForecastPvPanel.tsx
    screens/
      SunCastScreen.tsx
      SunCastSidebar.tsx
      SunCastCanvas.tsx
    hooks/
  geometry/
    projection/
    solver/
    mesh/
    sun/
  rendering/
    roof-layer/
  state/
    project-store/
  types/
docs/
```

---

# Documentation

Detailed product design and roadmap live in:

```
docs/
```

These documents describe:

* use cases
* geometry solver
* solar estimation logic
* UI workflow

---

# Development Notes

Important design principles:

* **geometry first** — roof plane derived from vertex heights
* **capacity weighted estimation** — polygons contribute according to kWp
* **clear-sky estimate** — deterministic local irradiance model used by geometric charts
* **weather forecast estimate** — short-term forecast panel uses Open-Meteo weather inputs
* **editor state driven UI**

---

# Contributing

Recommended development workflow:

1. read relevant **UC*.md** in `docs/`
2. update logic or UI
3. add or update tests
4. verify with Playwright E2E

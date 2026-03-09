1) Fix core rendering (must)

Render mesh in local-meter frame + single Mercator origin (XY and Z scaled by the same meterInMercatorCoordinateUnits()).

Triangulate (earcut) in local meters, not lon/lat degrees.

2) Add 2 overlay layers (always available via toggle)

Add a DebugOverlayLayer (custom layer or GeoJSON) that can render:

A) Original footprint (flat grey, ground)

Existing 2D fill/line (keep as-is), but explicitly label it as “Ground footprint”.

Draw order: place it below 3D roof.

B) Projected roof polygon (green, with heights)

Draw the top face boundary as a green LINE_LOOP using the same vertices that go into the 3D roof, after solving heights.

Optional: draw vertical “stems” (lines) from base vertex to top vertex for each corner (clear height cue).

Implementation notes:

Build top vertices from solver output: {lon, lat, heightM}.

Convert to world coordinates using the same conversion as the 3D mesh (local meters → merc origin).

Use a separate VBO + simple shader for debug lines (no lighting, constant color) or use MapLibre GeoJSON with line-color if you encode altitude via custom layer.

3) On-map diagnostics (text)

When debug is enabled, show a small HUD:

constraint count

minHeight / maxHeight / span

pitchDeg (roof slope)

mesh triangle count

current map pitch/zoom

4) UX improvements to avoid “looks flat”

Orbit mode: auto-hide the 2D fill (keep outline only) to prevent masking.

Add temporary Z exaggeration (editing-only) default ×5.

Input behavior: apply constraint on Enter/blur (reduce “I set height but nothing happens”).

5) Regression tests

Unit test: local-meter triangulation produces non-empty triangles for concave shapes.

Render test (headless): when height span > X, debug stems count == vertex count and dz > 0.
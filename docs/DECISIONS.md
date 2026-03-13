# Decisions

## D1. Geometry Is Authoritative

- Status: accepted
- Decision: persist footprints and constraints; regenerate meshes/metrics.
- Why: deterministic behavior and reproducible project reloads.

## D2. Solver Runs In Local Meters

- Status: accepted
- Decision: project lon/lat to local metric coordinates before solving.
- Why: geometric operations in geographic coordinates are unstable and not dimension-accurate.

## D3. Reducer-Centric Project State

- Status: accepted
- Decision: use command-oriented reducer/store for footprint mutations and persistence.
- Why: explicit transitions and easier regression testing.

## D4. App-Level Degraded Runtime Handling

- Status: accepted
- Decision: global error boundary plus feature-level fallback messaging.
- Why: vendor operations need graceful failure, not blank app crashes.

## D5. CI Gate Before Deploy

- Status: accepted
- Decision: deploy workflow runs only after successful CI on `main`.
- Why: prevent shipping unvalidated builds.

## D6. Mode-Agnostic Map Interaction Resolution

- Status: accepted
- Decision: map interactions (hover/click/drag hit resolution) are mode-agnostic; routing is based on hit target (`roof`/`obstacle`) instead of the current edit mode.
- Why: roof and obstacle use the same vertex/edge interaction mechanics, so mode gates create unnecessary divergence and duplicated logic.

## D7. Obstacles And Shading Settings Are Canonical Inputs

- Status: accepted
- Decision: persist obstacle definitions and shading settings in project state/storage as explicit inputs; do not persist shading outputs or overlay geometry.
- Why: shading and obstacle modeling must be reproducible from canonical inputs and remain consistent with the geometry-first source-of-truth rule.

## D8. Progressive Shading Computation During Interaction

- Status: accepted
- Decision: run lower-cost coarse shading while geometry is actively edited/dragged, then resolve to full-resolution shading when interaction settles; cache by deterministic input fingerprint.
- Why: preserves UI responsiveness during edits while keeping final shading output deterministic for stable inputs.

## D9. Worker-First Roof Heatmap Overlay Build With Fail-Closed Degradation

- Status: accepted
- Decision: build roof heatmap overlay geometry in a Web Worker when available; on worker unavailability/failure/dispatch errors, stop heatmap processing and surface a typed recoverable app error.
- Why: heavy triangulation/projection work should not block map interaction, and failure handling must be explicit and deterministic instead of silently switching execution modes.

## D10. Selective Legacy-Default Upgrade For Shading Grid Resolution

- Status: accepted
- Decision: automatically upgrade persisted shading grid resolution from legacy default (`0.5 m`) to current default (`0.1 m`) only when solver config version changes and the stored value still equals the legacy default.
- Why: this preserves explicit user-tuned settings while updating likely-default legacy projects to current quality expectations.

## D11. Fail-Closed Storage Schema Handling

- Status: accepted
- Decision: reject unknown future storage schema versions during load instead of attempting best-effort parsing.
- Why: prevents silent state corruption or undefined behavior when payload semantics evolve beyond the running app version.

## D12. Shared Three Renderer Per Map WebGL Context

- Status: accepted
- Decision: custom 3D layers share a single `THREE.WebGLRenderer` instance per map WebGL context with reference-counted lifecycle management.
- Why: reduces renderer duplication, avoids unnecessary GPU/resource overhead, and keeps multi-layer rendering consistent.

## D13. Half-Year Mirroring Option For Annual Simulation

- Status: accepted
- Decision: annual sun-access simulation may run on sampled windows across half-year and mirror/weight results to approximate full-year metrics.
- Why: lowers computational cost while maintaining acceptable approximation for comparative planning workflows.

## D14. Bounded Shading Complexity Through Prefiltering And Distance Clamp

- Status: accepted
- Decision: shading scene preparation prefilters obstacle candidates per roof by expanded bounding boxes and applies configurable max shadow-distance clamp.
- Why: constrains worst-case ray-casting workload and keeps shading computation tractable as scene size grows.

## D15. Layer-Relative Rebasing For Custom 3D Map Layers

- Status: accepted
- Decision: roof, obstacle, and heatmap custom layers render geometry in layer-relative coordinates and apply one per-layer anchor translation in the camera projection matrix.
- Why: prevents float32 precision loss when adding meter-scale deltas to large Mercator anchor values; without rebasing, small geometry can collapse/jitter/disappear at runtime.

## D16. Typed Operational Errors With Central Toast Notification Channel

- Status: accepted
- Decision: model operational failures with typed `AppError` (`code`, `severity`, `recoverable`, `context`) and `Result<T, E>` at key boundaries; report through central `reportAppError*` services; present user-facing operational failures via one global toast channel (`app.error`) and success notifications via the same channel (`app.success`).
- Why: removes silent failure erasure, standardizes telemetry, and gives users a single consistent notification surface while keeping local feature fallback logic explicit.

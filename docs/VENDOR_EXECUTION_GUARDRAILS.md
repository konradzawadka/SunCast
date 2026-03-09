# Vendor Execution Guardrails

This document is **normative**. Vendors must follow it when modifying this repository.

If this document conflicts with older notes, tickets, or informal guidance, **this document wins**.

---

# 1. Purpose

This repository is not a generic map app. It is a **geometry-first roof modeling system** with map-based editing and solar-analysis workflows.

The main delivery risk is not “feature incompleteness”. The main delivery risk is **silent architectural decay**:

- geometry logic leaking into UI
- orchestration becoming a monolith
- regressions in editing flows
- browser/API compatibility issues hidden behind green builds
- undocumented behavior changes
- derived data becoming persistent source of truth

This document exists to prevent that.

---

# 2. Non-negotiable system invariants

The following rules are mandatory.

## 2.1 Canonical data model

**Canonical project state = footprint + constraints + explicit project inputs.**

The following are **derived artifacts** and must never become canonical persisted truth:

- solved roof planes
- generated meshes
- rendering buffers
- temporary map interaction state
- forecast/search results
- view-only annotations that can be regenerated

A vendor must not introduce persistence of derived roof geometry as authoritative state.

## 2.2 Geometry boundary

All geometry solving must remain in pure, deterministic modules.

Mandatory properties:

- no React dependency
- no DOM dependency
- no MapLibre dependency
- no browser storage dependency
- deterministic output from deterministic input
- explicit units and coordinate conversion

No vendor PR may implement geometry math inside:

- components
- hooks
- screens
- map interaction handlers
- rendering adapters

## 2.3 Coordinate rule

Geometric calculations must run in projected planar units, not raw lon/lat.

Vendor code must not:

- compute distances in lon/lat directly
- solve planes in lon/lat directly
- compare roof geometry in degree space as if it were metric geometry

## 2.4 Failure mode rule

External provider failure must degrade functionality gracefully.

This includes at least:

- place search
- weather / forecast
- tile imagery
- share APIs
- compression APIs
- clipboard APIs

The app must continue to protect local project editing even when these capabilities are unavailable.

---

# 3. Current repository risks that vendors must actively avoid

## 3.1 Orchestration bloat

`src/app/hooks/useSunCastController.ts` is already a concentration point.

This is the highest-risk file for future decay because it can easily absorb:

- editing logic
- selection logic
- tutorial state
- sharing logic
- map navigation
- keyboard behavior
- side effects across multiple features

Vendor rule:

- do not expand this file as the default implementation destination
- new logic must be pushed into feature-specific sub-hooks or pure modules
- the top controller should compose behavior, not own all behavior

A PR that increases coupling inside the controller without a strong reason should be rejected.

## 3.2 Documentation drift

The repo already contains substantial documentation. That is an asset, but also a risk.

Vendor rule:

- docs must describe current behavior, not intended behavior
- stale names, stale paths, and transitional language are defects
- if behavior changes, docs must be updated in the same PR

## 3.3 Green CI does not equal safe delivery

A passing build is not enough if the PR breaks:

- map editing
- selection semantics
- share/load compatibility
- degraded-mode behavior
- browser support assumptions

Vendor rule:

- UI-critical flows require proof, not assertion

---

# 4. Mandatory architectural rules

## 4.1 Layering

The repository should continue to respect these responsibilities:

### Domain / pure logic

Examples:

- `src/geometry/*`
- deterministic calculation helpers
- serialization / migration helpers that are independent from UI

Responsibilities:

- solve
- validate
- transform
- sanitize
- serialize deterministically

### Application orchestration

Examples:

- `src/app/hooks/*`
- controller composition
- command dispatch
- feature-level flow coordination

Responsibilities:

- bind domain actions to UI
- connect store + rendering + side effects
- keep orchestration readable and bounded

### UI / interaction

Examples:

- screens
- components
- map interaction handlers

Responsibilities:

- collect user input
- display current state
- surface errors/warnings
- delegate logic

### Rendering

Examples:

- `src/rendering/*`

Responsibilities:

- consume solved output
- render efficiently
- stay independent from business rules

## 4.2 Direction of dependency

Preferred direction:

`domain -> app orchestration -> UI/rendering`

Not allowed:

- domain importing UI
- domain importing map components
- rendering redefining domain rules
- UI persisting derived mesh as truth

## 4.3 Feature growth rule

When adding features, vendors must prefer:

- new focused module
- new focused hook
- new reducer action / selector
- new pure helper with tests

instead of enlarging existing central orchestrators.

---

# 5. Refactoring requirements before major feature expansion

The following work should be treated as **required technical hardening**, not optional cleanup.

## 5.1 Split the main controller

The existing controller should be decomposed into narrower units such as:

- editing controller
- selection controller
- sun-tools controller
- tutorial controller
- sharing controller

Exact naming may vary, but the outcome must be:

- smaller files
- clearer ownership
- lower merge conflict risk
- fewer hidden side effects

## 5.2 Formalize browser capability boundaries

The repository uses browser/platform features whose support may vary, especially around:

- `CompressionStream`
- `DecompressionStream`
- `navigator.share`
- clipboard access
- browser-specific encoding behavior

Vendor obligations:

- document supported browsers explicitly
- implement capability checks explicitly
- define expected fallback behavior explicitly
- test degraded mode explicitly

## 5.3 Strengthen observability contract

Current local observability scaffolding is not enough for vendor-grade regression control.

At minimum, the codebase should have a stable abstraction for:

- exception capture
- event recording
- metric recording

Vendor rule:

- do not scatter raw console-based diagnostics as the primary runtime strategy
- do not wire business logic directly to a specific telemetry provider
- keep an adapter boundary

---

# 6. Delivery quality gates

These are mandatory for vendor PR acceptance.

## 6.1 Required CI gates

Every PR must pass:

- lint
- typecheck
- unit/integration tests
- production build
- Playwright smoke coverage for critical flows

If any of the above is absent from CI, the repository should be upgraded before broad vendor development begins.

## 6.2 Coverage policy

Coverage should not be tracked for vanity. It must defend risk areas.

Mandatory priority areas for automated tests:

- geometry solving
- mesh generation
- project serialization / migration / hydration
- share encoding / decoding compatibility
- map-editing helper logic
- degraded behavior of provider-backed features

A vendor may not reduce meaningful test coverage around these areas without explicit approval.

## 6.3 PR proof requirements

A PR is incomplete unless it includes evidence appropriate to its impact.

Examples:

- architecture-affecting PR: rationale + boundary explanation
- UX-affecting PR: before/after screenshots or recordings
- map interaction PR: explicit flow validation
- share/storage PR: backward compatibility proof
- external provider PR: degraded-mode proof

---

# 7. Rules for map editing and interaction changes

Map interaction code is high-risk because regressions are often subtle.

Any PR touching drawing, dragging, selecting, hovering, snapping, or camera/map coordination must include validation of:

- creating a footprint
- selecting roof/vertex/edge correctly
- editing constraints without accidental mode switching
- preserving state after cancel/reset flows
- avoiding unintended drag/select conflicts
- stable behavior after reload where relevant

No vendor should merge interaction changes based only on “manual spot check looked okay”.

---

# 8. Rules for persistence, sharing, and migration

Persistence and sharing are contract surfaces.

Vendor rules:

- saved data must remain forward-safe and backward-aware where supported
- migrations must be explicit and tested
- corrupted or unsupported payloads must fail safely
- share links must not silently mutate canonical meaning

For any change to config encoding, schema shape, migration logic, or hydration path, the PR must include:

- compatibility notes
- tests
- degraded-mode behavior

---

# 9. Rules for external providers

The app intentionally uses third-party providers for major auxiliary features. That is acceptable only if behavior is bounded.

Vendor requirements:

- provider integration must live behind a small adapter boundary
- response parsing must be defensive
- network failure must be non-fatal where possible
- no provider-specific assumptions should leak deeply into UI code
- caching/retry/fallback behavior must be explicit

Provider-backed capabilities must never be allowed to destabilize the core local editing experience.

---

# 10. Performance guardrails

The current app appears viable, but performance can degrade quickly as features accumulate.

Vendor rules:

- avoid unnecessary recomputation of solved roof data
- avoid hidden full-tree rerenders during editing
- avoid uncontrolled cache growth
- avoid work in high-frequency pointer/mouse handlers unless bounded
- measure before introducing complex optimization claims

Any PR that increases compute work on drag/move/edit paths must justify that cost.

Recommended additions:

- explicit performance budget for critical interactions
- instrumentation around solve/render latency
- smoke checks on larger project examples

---

# 11. Documentation contract

The repository already has many docs. From now on, documentation quality must be treated as part of deliverable quality.

Mandatory documentation rules:

- one PR must not leave code and documentation disagreeing
- architecture docs must describe current structure
- runbook must match current deployment reality
- handover docs must remain actionable for a new team
- renamed files/modules must be updated in docs immediately

Examples of unacceptable documentation defects:

- stale module paths
- old product names
- placeholder text
- describing behavior that no longer exists
- implicit tribal knowledge without written handover notes

---

# 12. Vendor acceptance checklist

A vendor change should be rejected if any of the following is true:

- it pushes domain logic into UI code
- it expands central orchestration without justification
- it changes canonical project semantics through derived data
- it changes share/persistence behavior without compatibility proof
- it adds provider coupling without graceful degradation
- it changes interaction semantics without explicit validation
- it changes runtime assumptions without browser support notes
- it updates behavior without updating relevant documentation

---

# 13. Immediate remediation backlog

The following items should be treated as priority improvements before or during vendor onboarding.

## High priority

1. Split `useSunCastController` into narrower controllers/sub-hooks.
2. Add Playwright smoke flows to CI.
3. Enforce coverage thresholds for risk-heavy areas.
4. Define supported-browser matrix and fallback behavior for sharing/compression features.
5. Strengthen observability into a real adapter contract.
6. Create vendor-facing acceptance scenarios for primary user journeys.

## Medium priority

1. Add CODEOWNERS.
2. Add PR template with proof requirements.
3. Add release/versioning discipline.
4. Add dependency/security checks.
5. Reduce documentation duplication and remove stale references.

## Lower priority

1. Document cache behavior more explicitly.
2. Remove remaining placeholders and transitional naming.
3. Add performance reporting for larger test scenarios.

---

# 14. Expected vendor behavior

A good vendor should behave as follows:

- protect invariants first
- prefer small isolated PRs
- keep pure logic pure
- prove risky UI changes
- keep docs synchronized
- avoid clever shortcuts that trade speed for hidden future cost

A vendor that repeatedly violates these rules is not lacking context. It is failing repository discipline.

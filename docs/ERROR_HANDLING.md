# Error Handling Strategy

This document defines the canonical error-handling model for SunCast.

It describes:
- how failures are modeled
- where failures are handled
- how users are notified
- how we test and evolve this behavior

The goal is deterministic behavior, clear observability, and predictable UX under failure.

## 1. Core Principles

1. Geometry-first safety: never compromise canonical geometry/state rules to hide errors.
2. Typed operational failures: expected failures are modeled as typed app errors, not erased with `null` or bare `catch`.
3. Local handling, central reporting: each feature decides fallback/retry/stop behavior; reporting is centralized.
4. Single user error channel: user-facing operational failures are shown through one global toast system.
5. Crash boundary remains last resort: fatal/unexpected runtime failures go to `AppErrorBoundary`.

## 2. Error Model

Operational failures use `AppError`.

Fields:
- `code`
- `message`
- `severity` (`info | warning | error | fatal`)
- `recoverable` (`boolean`)
- `cause` (optional)
- `context` (optional metadata)

Implementation:
- `src/shared/errors/appError.ts`

Policy defaults are centralized in `APP_ERROR_POLICY` and must be the single place for severity/recoverable defaults.

## 3. Result Boundaries

Expected failure boundaries use `Result<T, E>`:
- success: `{ ok: true, value }`
- failure: `{ ok: false, error }`

Implementation:
- `src/shared/errors/result.ts`

Rule:
- Domain/application boundaries should prefer `Result` for expected failures instead of throw-or-null.

## 4. Central Reporting

All operational failures are recorded through:
- `reportAppError(error)`
- `reportAppErrorCode(code, message, options)`

Success notifications that should be user-visible use:
- `reportAppSuccess(message, context?)`
- `reportAppInfo(message, context?)` for informational toasts

Implementation:
- `src/shared/errors/reportAppError.ts`

Reporter responsibilities:
- emits structured observability events (`app.error`, `app.success`, `app.info`, `app.info.dismiss`)
- forwards severe failures (`error`, `fatal`) to exception capture
- never decides feature behavior

## 5. User Notification Policy

### 5.1 Single toast channel

Operational user-facing errors, success events, and processing info are shown in one global toast stack.

Implementation:
- `src/app/components/GlobalErrorToasts.tsx`
- mounted in `src/App.tsx`

### 5.2 No decentralized error banners

Feature-specific inline error banners for operational failures are not the primary channel.
Features should report centrally and rely on global toasts.

### 5.3 Processing toast lifecycle

Long-running compute work uses one shared sticky processing toast keyed by `compute-processing`.

API:
- `startGlobalProcessingToast(source, message?)`
- `stopGlobalProcessingToast(source)`

Rules:
- one toast is shared across multiple compute sources
- toast is reference-counted by `source`
- minimum visible duration: `2s`
- maximum visible duration: `60s` (auto-dismiss safety cap)
- dismiss happens when all active sources stop and minimum duration is satisfied
- if max duration is reached while compute is still active, the processing toast is suppressed until sources return to idle

Current wired sources:
- geometry compute (`controller.compute`, from presentation state)
- forecast compute

### 5.4 Toast actions for recoverable failures

Error toasts may expose action buttons when payload includes `enableStateReset: true`.

Current action contract:
- `reset-state`
- `share-state`

Event bridge:
- UI dispatches `GLOBAL_ERROR_TOAST_ACTION_EVENT_NAME`
- presentation state handles actions (state reset/share URL generation)

Implementation:
- `src/app/components/GlobalErrorToasts.tsx`
- `src/app/components/globalErrorToastActions.ts`
- `src/app/presentation/useSunCastPresentationState.ts`

### 5.5 Fatal failures

Unexpected runtime crashes still use:
- `src/app/components/AppErrorBoundary.tsx`

This is intentionally separate from operational toasts.

## 6. Layer Responsibilities

### Domain / pure geometry (`src/geometry/*`)
- deterministic and pure
- return typed failures for expected invalid input/state
- never import UI

### Application orchestration (`src/app/presentation/*`, `src/app/hooks/*`)
- converts domain/app failures into user flow decisions
- reports with `reportAppError*`
- avoids silent fallback

### UI (`src/app/components/*`, `src/app/screens/*`, feature panels)
- does not invent failure semantics
- consumes computed state and triggers commands
- uses global toast channel for operational notifications

### Global runtime boundary
- catches only unexpected crashes
- reports as fatal

## 7. Current Boundary Conversions

Implemented high-value boundaries:
- storage hydration: `readStorageResult(...)`
- shared URL decode: `decodeSharePayloadResult(...)`
- shared payload deserialize: `deserializeSharePayloadResult(...)`
- obstacle mesh generation: `generateObstacleMeshResult(...)`
- map heatmap worker failure reporting: `HEATMAP_WORKER_UNAVAILABLE`
- compute-progress reporting with shared lifecycle and bounded visibility

Representative files:
- `src/state/project-store/projectState.storage.ts`
- `src/shared/utils/shareCodec.ts`
- `src/state/project-store/projectState.share.ts`
- `src/geometry/mesh/generateObstacleMesh.ts`
- `src/app/features/map-editor/MapView/hooks/useMapInstance.ts`
- `src/shared/errors/reportAppError.ts`
- `src/app/components/GlobalErrorToasts.tsx`

## 8. Severity and Recovery Policy

Use these semantics:
- `info`: non-problem informational event
- `warning`: degraded but usable
- `error`: feature failed but app can continue
- `fatal`: unrecoverable runtime fault

`recoverable` must reflect whether user can continue workflow without reload.

## 9. Error Code Governance

Error codes live in `AppErrorCode` and must be:
- stable
- concise
- behavior-oriented (not implementation trivia)

When adding a code:
1. add code to `AppErrorCode`
2. add default policy in `APP_ERROR_POLICY`
3. use it from boundary source(s)
4. cover with tests in affected module

## 10. Feature Failure Rules

When processing fails:
1. stop the failing feature path explicitly
2. report a typed error with contextual metadata
3. avoid silent recovery or hidden fallback behavior

Example:
- Heatmap worker unavailable -> stop heatmap processing + `HEATMAP_WORKER_UNAVAILABLE` report.

## 11. Testing Strategy For Error Handling

### Unit-level expectations
- `Result` APIs return typed failures for invalid inputs.
- Error code/severity/recoverable fields are correct.
- Failure paths are deterministic.

### Integration/E2E expectations
- Provider failures surface explicit errors instead of stale-data fallback.
- Failures surface through global toasts (not silent failure).
- Long-running compute surfaces processing toast with bounded lifetime behavior.
- Crash path still routes through `AppErrorBoundary`.

Recommended test areas:
- storage parse/migration failure
- shared URL decode/schema failure
- mesh build invalid geometry
- worker unavailable/dispatch failure
- provider API failures (place search/forecast)
- processing toast lifecycle: start, sticky, min/max visibility, dismiss key behavior

## 12. Implementation Checklist (PR)

When touching error behavior, verify:
1. boundary returns typed failure (`Result` where expected)
2. no `catch { return null }` in critical path
3. failure reported via `reportAppError*`
4. user receives toast when relevant
5. failure behavior explicit and deterministic
6. tests updated for both success and failure paths
7. docs updated when policy/boundary behavior changes

## 13. Non-Goals

- A single giant global handler that swallows all failures.
- Converting programmer bugs into soft warnings.
- Hiding severe faults to keep UI superficially “green”.

## 14. Evolution Plan

Next improvements should prioritize:
1. remaining legacy null-swallow paths in non-critical modules
2. stronger code-level taxonomy for validation vs operational vs fatal
3. toast dedupe/rate-limit policy tuning for noisy sources
4. richer runbook mapping: error code -> operator action

## Pull request strategy

For this repo, PR strategy should optimize for:

* safe handover to vendor
* low regression risk
* readable history
* easy rollback
* small review surface

## Core rule

**One PR = one intention.**

Do not mix:

* refactor
* feature
* bugfix
* docs
* DevOps

If one PR changes architecture, UX, CI, and feature behavior at once, vendor review becomes weak and rollback becomes ugly.

---

## Recommended PR types

Use only these categories:

### 1. `infra/*`

For:

* CI
* build
* deploy
* lint
* tooling
* dependency policy

Examples:

* `infra/add-lockfile-and-ci-validation`
* `infra/split-pages-deploy-from-ci`

### 2. `refactor/*`

For:

* file split
* renaming
* boundary cleanup
* selector extraction
* hook decomposition

Rule:

* no intended product behavior change

Examples:

* `refactor/split-use-suncast-controller`
* `refactor/extract-map-interaction-modules`

### 3. `fix/*`

For:

* actual broken behavior
* edge-case correction
* state corruption
* rendering bug

Examples:

* `fix/share-codec-browser-fallback`
* `fix/forecast-date-handling`

### 4. `feature/*`

For:

* new user-visible capability

Examples:

* `feature/project-report-export`
* `feature/scenario-comparison`

### 5. `docs/*`

For:

* README
* handover docs
* ADR
* diagrams
* runbook

Examples:

* `docs/vendor-handover-pack`
* `docs/refresh-architecture-boundaries`

---

## Branching model

Keep it simple:

* `main` = always releasable
* short-lived feature branches only
* no long-running integration branch unless vendor explicitly requires it

Branch naming:

* `infra/...`
* `refactor/...`
* `fix/...`
* `feature/...`
* `docs/...`

---

## PR size policy

Target:

* **ideal:** up to 300 changed lines
* **acceptable:** 300–700
* **exceptional:** 700+ only for mechanical rename or generated updates

For this repo especially:

* big controller split should be done as **sequence of small refactor PRs**
* not one mega cleanup PR

---

## Mandatory PR template

Every PR should contain these sections:

### Summary

What changed in 2–4 sentences.

### Why

Why this PR exists, what risk or need it addresses.

### Scope

Explicitly say what is included and what is not included.

### Impact

* user-visible impact
* developer impact
* deployment impact

### Risks

What could break.

### Validation

Exactly how it was tested:

* unit tests
* E2E
* manual flow
* build
* lint

### Rollback

How to revert safely.

---

## Review rules

### For every PR

Require:

* 1 reviewer minimum internally
* vendor-facing branches: 2 reviewers for infra / architecture PRs if possible

### Reviewer checklist

Reviewer should check only 5 things:

1. does PR have one clear intention
2. are boundaries improved or degraded
3. are tests adequate for risk
4. is docs update needed
5. is rollback obvious

---

## Merge policy

Use **squash merge** by default.

Why:

* cleaner history
* one revertable unit
* easier vendor reading

Exception:

* stacked PRs where commit history carries meaning, then rebase is acceptable

---

## Required CI gates before merge

Minimum:

* install
* lint
* unit tests
* build

For risky PRs also:

* Playwright smoke
* coverage diff
* preview deployment if available

No merge on red CI.
No “will fix later” on broken pipeline.

---

## Best strategy for your repo specifically

Do handover in **waves**.

### Wave 1 — delivery trust

* lockfile
* CI
* deploy cleanup
* branch protection
* PR template

### Wave 2 — structural readability

* split `useSunCastController`
* split `useMapInteractions`
* split reducer
* rename stale concepts

### Wave 3 — documentation trust

* architecture doc
* runbook
* vendor handover doc
* active vs archived docs

### Wave 4 — resilience

* error boundary
* fallback states
* schema version policy
* share/browser compatibility hardening

### Wave 5 — performance

* memoization
* caching
* selective recompute
* profiling fixes

This is better than mixing everything into “big cleanup”.

---

## What must never happen

Avoid these PRs:

* “massive cleanup”
* “vendor prep”
* “refactor + feature + CI”
* “rename + behavior change”
* “format whole repo + logic changes”

These destroy review quality.

---

## Good PR sequence example

1. `infra/add-package-lock-and-ci`
2. `infra/separate-ci-and-pages-deploy`
3. `docs/add-pr-template-and-review-checklist`
4. `refactor/extract-suncast-controller-selectors`
5. `refactor/extract-suncast-controller-share-flow`
6. `refactor/extract-map-interaction-hit-testing`
7. `fix/add-share-codec-fallback`
8. `docs/refresh-architecture-and-runbook`

That is a strong vendor-facing sequence.

---

## Decision rule

Before opening PR, ask:

**Can reviewer describe this PR in one sentence?**

If not, split it.

---

## Recommended PR template text

```md
## Summary
Brief description of the change.

## Why
Why this PR is needed.

## Scope
Included:
- ...

Not included:
- ...

## Impact
- User-facing:
- Developer-facing:
- Deployment:

## Risks
- ...

## Validation
- [ ] npm run lint
- [ ] npm run test
- [ ] npm run build
- [ ] manual smoke test
- [ ] e2e smoke test (if applicable)

## Rollback
Revert squash commit. No data migration / Requires reverting follow-up PR / etc.
```

---

## Final recommendation

For your case:

**Use small stacked PRs, squash merge, strict single-intent scope, and separate handover into infra → refactor → docs → resilience → performance.**

That is the cleanest strategy for vendor pressure.

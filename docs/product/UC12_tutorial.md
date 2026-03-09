## PLAN — Guided Tutorial With Intro Overlay (Feature Walkthrough)

### Goal

Introduce a **guided onboarding tutorial** that visually explains the main workflow of the app:

1. A **quick guide intro overlay** (workflow + shortcuts + system notes).
2. A **step-by-step spotlight tutorial** with cloud overlays.

The tutorial should **not block the UI completely**, but guide the user by highlighting the correct controls and areas.

---

# Tutorial Flow

The interactive tutorial consists of **6 ordered steps**.

Each step highlights a specific UI element or map area using a **cloud / spotlight overlay**.

The user enters this flow from the sidebar `?` button:

1. `?` opens intro overlay.
2. User clicks **Start interactive tutorial**.
3. Spotlight tutorial starts at step 1.

---

# Intro overlay (pre-tutorial)

### Purpose

Show compact onboarding context before the interactive walkthrough.

### Content blocks

* Workflow summary:
  * draw polygon
  * set `kWp`
  * set height constraints
  * solve/inspect roof
  * adjust roof pitch
* Keyboard shortcuts:
  * `Ctrl/Cmd + A` select all footprints (outside text inputs)
  * `Shift` while drawing disables right-angle snap
  * `Tab` while drawing focuses edge-length input
  * `Enter` in edge-length input commits draw point
  * `Arrow Up/Down` in Sun DateTime shifts day
  * `Shift + Arrow Up/Down` in Sun DateTime shifts hour
  * `Enter` in vertex/edge height inputs applies value
  * `Escape` cancels drawing or closes intro overlay
  * `Shift` + height gizmo click uses large height step

### Intro overlay close behavior

User can close via:

* Close button
* backdrop click
* `Escape`

---

# Step 1 — Draw your roof polygon

### Purpose

Teach the user how to start drawing a roof footprint.

### UI behavior

Show cloud over:

* the **map/canvas area**

Instruction text:

> Draw your roof by clicking on the map to place polygon corners.

### Conditions to advance

User places **at least 3 vertices**.

System detects:

```
polygon.vertexCount >= 3
```

When the third vertex is placed, tutorial proceeds to Step 2.

---

# Step 2 — Finish polygon

### Purpose

Explain that polygon must be finalized.

### UI behavior

Highlight the **Finish button**.

Cloud overlay target:

* `Finish polygon button`

Instruction text:

> Click Finish to complete the roof polygon.

### Visibility rule

Finish button should appear when:

```
polygon.vertexCount >= 3
```

Tutorial waits until user clicks **Finish**.

---

# Step 3 — Set kWp for the roof

### Purpose

Explain installed PV capacity per polygon.

### UI behavior

Highlight the **kWp input field** in the footprint properties panel.

Cloud overlay target:

* `kWp input`

Instruction text:

> Enter the installed PV capacity for this roof (kWp).

### Conditions to advance

```
kwp > 0
```

User must input a positive value.

---

# Step 4 — Set vertex heights

### Purpose

Teach the user how to define roof slope.

### UI behavior

Highlight the **vertex heights input panel**.

Cloud overlay target:

* vertex height inputs
* vertex selection controls if present

Instruction text:

> Set the height of roof corners to define the roof slope.

### Conditions to advance

At least **three vertices have height values**.

```
vertexHeights >= 3
```

This ensures the roof plane can be solved.

---

# Step 5 — Confirm roof pitch

### Purpose

Teach the user to verify roof slope visually.

### UI behavior

Two visual highlights:

1. Cloud over **pitch indicator** or pitch value display.
2. Cloud over **orbit view control**.

Instruction text:

> Check the calculated roof pitch and view the roof in perspective to verify it looks correct.

User action encouraged:

* switch to orbit view
* inspect roof slope

No strict numeric validation required.

### Completion condition

User enters orbit view or closes tutorial.  

---

# Step 6 — Adjust date with arrows

### Purpose

Teach keyboard-first datetime navigation in the Sun tools panel.

### UI behavior

Highlight:

* `Sun Date & Time` input

Instruction text:

> In the Sun Date & Time input, use Arrow Up for previous day and Arrow Down for next day.

### Conditions to advance

User changes datetime using keyboard input (day/hour stepping supported).

---

# Overlay system

### Cloud overlay requirements

Tutorial should use a **spotlight style overlay**:

* dim background
* highlight target element
* optional arrow
* instruction text near highlight

Properties:

```
targetElement
description
stepIndex
completionCondition
```

---

# Tutorial state

Store tutorial progress locally:

```
tutorialState:
  completedSteps: number
  tutorialEnabled: boolean
```

Recommended storage:

```
localStorage
```

Behavior:

* tutorial runs automatically for new users
* user can skip
* once completed, it does not show again

---

# UI integration

Tutorial engine should run from **SunCastScreen**.

It observes:

* polygon creation
* vertex count
* kWp input value
* vertex heights
* orbit view activation
* datetime keyboard update

Tutorial step automatically advances when conditions are satisfied.

---

# Implementation structure

Suggested components:

```
TutorialManager
TutorialStep
CloudOverlay
SpotlightMask
```

Suggested hook:

```
useTutorial()
```

Responsibilities:

* track current step
* evaluate step conditions
* trigger overlay changes

---

# Step detection signals

Tutorial listens to these events:

| Event                  | Source             |
| ---------------------- | ------------------ |
| polygon vertex added   | map editor         |
| polygon finished       | finish button      |
| kWp changed            | input field        |
| vertex height changed  | height inputs      |
| orbit view activated   | camera controls    |
| datetime key-adjusted  | Sun DateTime input |

---

# Failure-safe behavior

Tutorial should not break workflow.

Rules:

* user can perform actions out of order
* tutorial detects state and jumps forward
* tutorial can be skipped anytime

---

# Optional improvements later

Not required for MVP:

* animated arrows
* ghost example polygon
* demo roof preview
* small progress bar (Step 1/6)
* replay tutorial button

---

# Acceptance criteria

Tutorial works correctly when:

1. New user sees tutorial on first editor load.
2. Step 1 highlights map area and waits for 3 vertices.
3. Step 2 highlights Finish button.
4. Step 3 highlights kWp input.
5. Step 4 highlights vertex height inputs.
6. Step 5 highlights pitch indicator and orbit view.
7. Step 6 highlights Sun DateTime keyboard navigation.
8. Tutorial advances automatically when step conditions are satisfied.
9. Tutorial can be skipped.
10. Tutorial completion is stored locally.
11. Tutorial never blocks core editing functionality.

---

interface TutorialIntroOverlayProps {
  onStartInteractiveTutorial: () => void
  onClose: () => void
}

const WORKFLOW_NOTES: string[] = [
  'Draw a footprint polygon on the map.',
  'Set up kWp (installed PV capacity) for the active roof.',
  'Assign height constraints to vertices or edges.',
  'Solve the roof to generate deterministic planar geometry.',
  'Use Orbit mode to visually verify roof geometry.',
  'Adjust roof pitch to tune final production assumptions.',
]

const KEYBOARD_SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: 'Ctrl/Cmd + A', description: 'Select all footprints (when focus is not inside an input).' },
  { keys: 'Shift (while drawing)', description: 'Temporarily disable right-angle snap.' },
  { keys: 'Tab (while drawing)', description: 'Focus the edge-length input in the draw hint.' },
  { keys: 'Enter (in edge-length input)', description: 'Commit the current draft point with the entered edge length.' },
  { keys: 'Arrow Up / Arrow Down (Sun DateTime)', description: 'Move datetime by day (-1 / +1).' },
  { keys: 'Shift + Arrow Up / Arrow Down (Sun DateTime)', description: 'Move datetime by hour (+1 / -1).' },
  { keys: 'Enter (vertex/edge height input)', description: 'Apply entered roof height constraint.' },
  { keys: 'Escape', description: 'Cancel drawing or close this intro overlay.' },
  { keys: 'Shift + height gizmo click', description: 'Adjust selected height by 1.0 m (default step is 0.1 m).' },
]

const INTERACTION_NOTES: string[] = [
  'Middle mouse drag in Orbit mode steers camera bearing and pitch.',
  'Vertex and edge dragging is blocked when geometry would become invalid.',
  'A solved plane requires at least 3 valid constraints.',
]

export function TutorialIntroOverlay({ onStartInteractiveTutorial, onClose }: TutorialIntroOverlayProps) {
  return (
    <>
      <button
        type="button"
        className="tutorial-intro-backdrop"
        aria-label="Close tutorial intro"
        data-testid="tutorial-intro-backdrop"
        onClick={onClose}
      />
      <aside className="tutorial-card tutorial-card-light tutorial-intro-card" role="dialog" aria-modal="true">
        <div className="tutorial-intro-actions">
          <button
            type="button"
            className="tutorial-intro-start-button"
            data-testid="start-interactive-tutorial-button"
            onClick={onStartInteractiveTutorial}
          >
            Start interactive tutorial
          </button>
          <button type="button" className="tutorial-intro-close-button" onClick={onClose}>
            Close
          </button>
        </div>

        <h3>SunCast quick guide</h3>

        <p className="tutorial-intro-section-title">Workflow</p>
        <ul className="tutorial-intro-list">
          {WORKFLOW_NOTES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className="tutorial-intro-section-title">Keyboard shortcuts</p>
        <ul className="tutorial-intro-list">
          {KEYBOARD_SHORTCUTS.map((shortcut) => (
            <li key={shortcut.keys}>
              <strong>{shortcut.keys}</strong>: {shortcut.description}
            </li>
          ))}
        </ul>

        <p className="tutorial-intro-section-title">System behavior</p>
        <ul className="tutorial-intro-list">
          {INTERACTION_NOTES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </aside>
    </>
  )
}

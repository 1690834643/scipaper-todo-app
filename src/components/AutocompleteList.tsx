// =============================================================================
// AutocompleteList — popup UI for FocusModeEditor's word/phrase suggestions.
//
// Driven by autocompleteExtension's onStateChange callback. Pure presentation:
// rendered as a fixed-position div positioned at the editor cursor.
//
// CLAUDE_DESIGN: this is the popup the user sees while typing. Should feel
// like a quiet ghost — appears on demand, never demands attention. Treat as
// a tooltip, not a panel.
// =============================================================================

import type { AutocompleteState } from '../utils/autocompleteExtension'

interface AutocompleteListProps {
  state: AutocompleteState
}

export function AutocompleteList({ state }: AutocompleteListProps) {
  if (!state.active || !state.coords || state.items.length === 0) {
    return null
  }

  const { coords, items, selectedIndex } = state

  return (
    <div
      className="focus-mode-autocomplete"
      style={{
        position: 'fixed',
        left: Math.round(coords.left),
        top: Math.round(coords.bottom + 4),
        zIndex: 1200,
      }}
      role="listbox"
    >
      <ul className="focus-mode-autocomplete-list">
        {items.map((item, index) => (
          <li
            key={`${item.kind}:${item.text}`}
            className={`focus-mode-autocomplete-item ${
              index === selectedIndex ? 'is-selected' : ''
            } focus-mode-autocomplete-item--${item.kind}`}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <span className="focus-mode-autocomplete-text">{item.label ?? item.text}</span>
            <span className="focus-mode-autocomplete-kind">
              {item.kind === 'phrase' ? '短语' : '词'}
            </span>
          </li>
        ))}
      </ul>
      <div className="focus-mode-autocomplete-hint">Tab/Enter 接受 · Esc 取消 · ↑↓ 切换</div>
    </div>
  )
}

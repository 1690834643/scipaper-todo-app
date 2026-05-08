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

import type { CSSProperties } from 'react'
import type { AutocompleteState } from '../utils/autocompleteExtension'

interface AutocompleteListProps {
  state: AutocompleteState
}

interface AutocompletePosition {
  left: number
  top: number
  maxHeight: number
  placement: 'top' | 'bottom'
}

// Used by contract tests; keep colocated with the popup so layout math and UI
// changes stay together.
// eslint-disable-next-line react-refresh/only-export-components
export function computeAutocompletePosition(
  coords: NonNullable<AutocompleteState['coords']>,
  itemCount: number,
): AutocompletePosition {
  const popupWidth = 320
  const margin = 12
  const rowHeight = 36
  const hintHeight = 30
  const maxListHeight = 280
  const estimatedHeight = Math.min(maxListHeight, Math.max(1, itemCount) * rowHeight) + hintHeight

  if (typeof window === 'undefined') {
    return {
      left: Math.round(coords.left),
      top: Math.round(coords.bottom + 4),
      maxHeight: maxListHeight,
      placement: 'bottom',
    }
  }

  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const belowTop = coords.bottom + 4
  const aboveTop = coords.top - estimatedHeight - 4
  const roomBelow = viewportHeight - belowTop - margin
  const roomAbove = coords.top - margin
  const placement: AutocompletePosition['placement'] =
    roomBelow < estimatedHeight && roomAbove > roomBelow ? 'top' : 'bottom'

  const availableHeight = Math.max(
    96,
    placement === 'top' ? roomAbove - 4 : roomBelow,
  )
  const top = placement === 'top'
    ? Math.max(margin, aboveTop)
    : Math.min(belowTop, viewportHeight - margin - Math.min(estimatedHeight, availableHeight))
  const left = Math.min(
    Math.max(margin, coords.left),
    Math.max(margin, viewportWidth - popupWidth - margin),
  )

  return {
    left: Math.round(left),
    top: Math.round(top),
    maxHeight: Math.round(Math.min(maxListHeight, availableHeight - hintHeight)),
    placement,
  }
}

export function AutocompleteList({ state }: AutocompleteListProps) {
  if (!state.active || !state.coords || state.items.length === 0) {
    return null
  }

  const { coords, items, selectedIndex } = state
  const position = computeAutocompletePosition(coords, items.length)
  const style: CSSProperties & { ['--autocomplete-max-height']?: string } = {
    position: 'fixed',
    left: position.left,
    top: position.top,
    zIndex: 1200,
    ['--autocomplete-max-height']: `${position.maxHeight}px`,
  }

  return (
    <div
      className="focus-mode-autocomplete"
      data-placement={position.placement}
      style={style}
      role="listbox"
    >
      <ul className="focus-mode-autocomplete-list">
        {items.map((item, index) => (
          <li
            key={`${item.kind}:${item.citeKey ?? item.text}`}
            className={`focus-mode-autocomplete-item ${
              index === selectedIndex ? 'is-selected' : ''
            } focus-mode-autocomplete-item--${item.kind}`}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <span className="focus-mode-autocomplete-text">{item.label ?? item.text}</span>
            {item.meta ? (
              <span className="focus-mode-autocomplete-meta">{item.meta}</span>
            ) : null}
            <span className="focus-mode-autocomplete-kind">
              {item.kind === 'citation' ? '引用' : item.kind === 'phrase' ? '短语' : '词'}
            </span>
          </li>
        ))}
      </ul>
      <div className="focus-mode-autocomplete-hint">
        Tab/Enter 接受 · Esc 取消 · ↑↓ 切换{items.some((i) => i.kind === 'citation') ? ' · @ 引用' : ''}
      </div>
    </div>
  )
}

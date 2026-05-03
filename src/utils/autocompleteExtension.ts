// =============================================================================
// AutocompleteExtension — TipTap extension for SCI vocabulary autocomplete.
//
// This is NOT @tiptap/suggestion. The suggestion plugin is mention-style
// (requires a trigger char like '@' or '/'). We want word-level autocomplete:
// type 3+ letters anywhere → popup of matching SCI words/phrases.
//
// Implementation: a single ProseMirror plugin that
//   1. on every doc/selection change, extracts the word currently being typed
//   2. filters SCI_WORDS + SCI_PHRASES (section-aware) by prefix
//   3. surfaces a popup positioned at the cursor (rendered by AutocompleteList)
//   4. Tab/Enter to accept, Esc to dismiss, ArrowUp/Down to navigate
//
// CLAUDE_DESIGN: this file is purely behavior. Visual hooks live on
// .focus-mode-autocomplete-* classes in focus-mode.css.
// =============================================================================

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { SciPhrase, SciSection } from '../data/sci-vocab'

const PLUGIN_KEY = new PluginKey<AutocompleteState>('focus-mode-autocomplete')

const MIN_QUERY_LENGTH = 3
const MAX_ITEMS = 8
// 允许字母 / 数字 / 撇号 / 连字符 / 斜杠出现在「正在键入的词」里：
// p53、5'UTR、CRISPR/Cas9 这类生物术语接受 suggestion 时，正则要把
// 整段词当作一个 token，否则替换范围只覆盖最后一段字母，导致重复粘连
// （比如把 `CRISPR/CRISPR/Cas9` 留在文档里）。
const WORD_BOUNDARY_REGEX = /[A-Za-z0-9][A-Za-z0-9'/-]*$/

export interface AutocompleteItem {
  /** What gets inserted (replaces the typed query). */
  text: string
  /** What's shown in the popup (defaults to text). */
  label?: string
  /** Word | Phrase — used for the small kind tag in the popup. */
  kind: 'word' | 'phrase'
}

export interface AutocompleteState {
  active: boolean
  /** The character range of the typed query in the doc (start = end of replacement). */
  from: number
  to: number
  /** The lower-cased query string the user typed. */
  query: string
  /** Items currently visible in the popup. */
  items: AutocompleteItem[]
  /** Highlighted index in items (cycled with ArrowUp/Down). */
  selectedIndex: number
  /** Cursor coords for popup positioning (left/top in viewport pixels). */
  coords: { left: number; top: number; bottom: number } | null
  /** True if the user dismissed the popup with Esc; we suppress until they
   *  start a new word. */
  dismissed: boolean
}

const EMPTY_STATE: AutocompleteState = {
  active: false,
  from: 0,
  to: 0,
  query: '',
  items: [],
  selectedIndex: 0,
  coords: null,
  dismissed: false,
}

export interface AutocompleteOptions {
  /** Returns the current SCI section so we can rank section-specific items. */
  getSection: () => SciSection
  /** Callback fired when state changes — host renders the popup. */
  onStateChange: (state: AutocompleteState) => void
  /** Word dictionary keyed by section (general always merged). */
  words: Record<SciSection, string[]>
  /** Phrase dictionary keyed by section. */
  phrases: Record<SciSection, SciPhrase[]>
}

export const AutocompleteExtension = Extension.create<AutocompleteOptions>({
  name: 'focusModeAutocomplete',

  addOptions() {
    return {
      getSection: () => 'general',
      onStateChange: () => undefined,
      words: { general: [], introduction: [], methods: [], results: [], discussion: [] },
      phrases: { general: [], introduction: [], methods: [], results: [], discussion: [] },
    }
  },

  addProseMirrorPlugins() {
    const opts = this.options
    // IME 兜底：composition 刚结束时浏览器通常会再发一个 keydown（确认拼音
    // 选词的 Enter / Space）。某些浏览器此时 isComposing 已置 false，
    // autocomplete 会把它当成接受 suggestion → 抢走 IME 确认。50ms 抑制窗口
    // 让 keydown 等 composition 完全结束再处理。
    let lastCompositionEndAt = 0
    const COMPOSITION_GUARD_MS = 50

    return [
      new Plugin<AutocompleteState>({
        key: PLUGIN_KEY,

        state: {
          init: () => EMPTY_STATE,
          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(PLUGIN_KEY) as Partial<AutocompleteState> | undefined

            // Highlight cursle in the popup — pure UI state, no recompute.
            if (meta?.selectedIndex !== undefined) {
              return { ...prev, selectedIndex: meta.selectedIndex }
            }
            // Explicit dismiss (Esc): hide popup but remember query so we
            // don't immediately resurface for the same word.
            if (meta?.dismissed === true) {
              return { ...prev, dismissed: true, active: false, items: [], coords: null }
            }
            // Everything else (incl. acceptItem's `dismissed: false` reset):
            // recompute from the new doc/selection. The reset clears any
            // prior dismiss flag BEFORE recomputing so a fresh popup can show.
            const baseline = meta?.dismissed === false ? { ...prev, dismissed: false } : prev
            return computeState(newState, baseline, opts)
          },
        },

        props: {
          handleDOMEvents: {
            compositionend() {
              lastCompositionEndAt = Date.now()
              return false
            },
          },
          handleKeyDown(view, event) {
            // Critical for IME (Chinese pinyin / Japanese kana etc.): never
            // intercept while the user is composing characters. event.isComposing
            // is the modern signal; keyCode === 229 is the legacy fallback some
            // IMEs still emit. Without this, Enter / Tab while picking a pinyin
            // candidate would be eaten by the autocomplete handler instead of
            // confirming the IME selection.
            if (event.isComposing || event.keyCode === 229) return false
            if (Date.now() - lastCompositionEndAt < COMPOSITION_GUARD_MS) return false

            const state = PLUGIN_KEY.getState(view.state)
            if (!state || !state.active || state.items.length === 0) return false

            if (event.key === 'ArrowDown') {
              event.preventDefault()
              const next = (state.selectedIndex + 1) % state.items.length
              view.dispatch(view.state.tr.setMeta(PLUGIN_KEY, { selectedIndex: next }))
              return true
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              const next = (state.selectedIndex - 1 + state.items.length) % state.items.length
              view.dispatch(view.state.tr.setMeta(PLUGIN_KEY, { selectedIndex: next }))
              return true
            }
            if (event.key === 'Tab' || event.key === 'Enter') {
              event.preventDefault()
              const item = state.items[state.selectedIndex]
              if (item) acceptItem(view, state, item)
              return true
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              view.dispatch(view.state.tr.setMeta(PLUGIN_KEY, { dismissed: true }))
              return true
            }
            return false
          },
        },

        view(_editorView) {
          let last: AutocompleteState = EMPTY_STATE
          return {
            update(view) {
              const next = PLUGIN_KEY.getState(view.state) ?? EMPTY_STATE
              // Recompute coords now that we have the view (DOM measurement).
              if (next.active && next.items.length > 0) {
                try {
                  const c = view.coordsAtPos(view.state.selection.from)
                  next.coords = { left: c.left, top: c.top, bottom: c.bottom }
                } catch {
                  next.coords = null
                }
              } else {
                next.coords = null
              }
              if (!shallowEq(last, next)) {
                last = next
                opts.onStateChange(next)
              }
            },
            destroy() {
              opts.onStateChange(EMPTY_STATE)
            },
          }
        },
      }),
    ]
  },
})

// ---- helpers ---------------------------------------------------------------

function computeState(
  newState: EditorState,
  prev: AutocompleteState,
  opts: AutocompleteOptions,
): AutocompleteState {
  const { selection } = newState
  if (!selection.empty) return EMPTY_STATE

  const $from = selection.$from
  const textBefore = $from.parent.textBetween(
    Math.max(0, $from.parentOffset - 80),
    $from.parentOffset,
    undefined,
    '￼',
  )
  const match = textBefore.match(WORD_BOUNDARY_REGEX)
  if (!match) return EMPTY_STATE

  const word = match[0]
  if (word.length < MIN_QUERY_LENGTH) {
    // Allow phrase trigger to fire below MIN_QUERY_LENGTH (some triggers are 2 chars)
    // but skip pure word matching.
  }

  // If the user just dismissed for this word, stay dismissed until the word
  // boundary changes (cursor moves, word shrinks/grows differently).
  if (prev.dismissed && prev.query === word.toLowerCase()) {
    return { ...prev, active: false, items: [], coords: null }
  }

  const section = opts.getSection()
  const items = rankItems(word, section, opts)
  if (items.length === 0) return EMPTY_STATE

  const from = selection.from - word.length
  const to = selection.from
  return {
    active: true,
    from,
    to,
    query: word.toLowerCase(),
    items,
    // Reset selectedIndex if items list changed substantially.
    selectedIndex: prev.active && prev.query === word.toLowerCase() ? prev.selectedIndex : 0,
    coords: null,
    dismissed: false,
  }
}

function rankItems(
  rawQuery: string,
  section: SciSection,
  opts: AutocompleteOptions,
): AutocompleteItem[] {
  const query = rawQuery.toLowerCase()
  const sectionWords = section === 'general' ? [] : opts.words[section] ?? []
  const generalWords = opts.words.general ?? []
  const sectionPhrases = section === 'general' ? [] : opts.phrases[section] ?? []
  const generalPhrases = opts.phrases.general ?? []

  // Single dedupe set across ALL candidates, keyed on a normalized form of
  // the inserted text. Normalization strips '-' and '/' so visual variants
  // like "CRISPR/Cas9" / "CRISPR-Cas9" or "knockout" / "knock-out" collide
  // and only one survives (whichever is encountered first — we process
  // phrases first, then section words, then general words).
  const seen = new Set<string>()
  const matched: { item: AutocompleteItem; score: number }[] = []

  function dedupeKey(text: string): string {
    return text.toLowerCase().replace(/[-/]/g, '')
  }

  function pushIfFresh(item: AutocompleteItem, score: number) {
    const key = dedupeKey(item.text)
    if (seen.has(key)) return
    seen.add(key)
    matched.push({ item, score })
  }

  // Phrases first (higher score, more keystrokes saved).
  if (query.length >= 2) {
    for (const phrase of sectionPhrases) {
      if (phrase.trigger.toLowerCase().startsWith(query)) {
        pushIfFresh(
          { text: phrase.text, label: phrase.label ?? phrase.text, kind: 'phrase' },
          110 - phrase.trigger.length,
        )
      }
    }
    for (const phrase of generalPhrases) {
      if (phrase.trigger.toLowerCase().startsWith(query)) {
        pushIfFresh(
          { text: phrase.text, label: phrase.label ?? phrase.text, kind: 'phrase' },
          100 - phrase.trigger.length,
        )
      }
    }
  }

  // Words next. Section-specific outranks general. Skip words that exactly
  // equal the query (no completion needed).
  if (query.length >= MIN_QUERY_LENGTH) {
    for (const word of sectionWords) {
      const lower = word.toLowerCase()
      if (lower.startsWith(query) && lower !== query) {
        pushIfFresh({ text: word, kind: 'word' }, 60 - (word.length - query.length))
      }
    }
    for (const word of generalWords) {
      const lower = word.toLowerCase()
      if (lower.startsWith(query) && lower !== query) {
        pushIfFresh({ text: word, kind: 'word' }, 50 - (word.length - query.length))
      }
    }
  }

  matched.sort((a, b) => b.score - a.score)
  return matched.slice(0, MAX_ITEMS).map((m) => m.item)
}

function acceptItem(view: EditorView, state: AutocompleteState, item: AutocompleteItem) {
  const { from, to } = state
  // Phrases inserted as-is. Words are inserted as-is too — capitalization
  // matches the dictionary entry. If the user already typed an uppercase
  // first letter, we capitalize the suggestion.
  const original = view.state.doc.textBetween(from, to)
  let text = item.text
  if (item.kind === 'word' && original.length > 0 && original[0] === original[0].toUpperCase()) {
    text = text[0].toUpperCase() + text.slice(1)
  }
  // Add a trailing space after a word so the user keeps typing fluidly.
  // For phrases, no trailing space — they often end with punctuation already.
  if (item.kind === 'word') text = `${text} `
  const tr = view.state.tr.insertText(text, from, to)
  tr.setMeta(PLUGIN_KEY, { dismissed: false })
  view.dispatch(tr)
  view.focus()
}

function shallowEq(a: AutocompleteState, b: AutocompleteState): boolean {
  if (a.active !== b.active) return false
  if (a.from !== b.from || a.to !== b.to) return false
  if (a.query !== b.query) return false
  if (a.selectedIndex !== b.selectedIndex) return false
  if (a.items.length !== b.items.length) return false
  for (let i = 0; i < a.items.length; i++) {
    if (a.items[i].text !== b.items[i].text) return false
  }
  if ((a.coords?.left ?? -1) !== (b.coords?.left ?? -1)) return false
  if ((a.coords?.top ?? -1) !== (b.coords?.top ?? -1)) return false
  return true
}

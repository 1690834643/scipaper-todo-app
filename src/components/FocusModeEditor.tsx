// =============================================================================
// FocusModeEditor — Immersive writing surface used as the "edit" view of every
// Section tab.
//
// Layout
//   Header  — breadcrumb · save dot / pomodoro · toolbar toggle.
//   Canvas  — TipTap editor + design-pack H2 outline ticks.
//   Footer  — word counts, daily goal, compact hints.
//
// Key UX rules
//   - Save indicator = single quiet dot.
//   - Snapshot policy: enter / 30-min interval / exit / Esc.
// =============================================================================

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import {
  AutocompleteExtension,
  type AutocompleteState,
} from '../utils/autocompleteExtension'
import { AutocompleteList } from './AutocompleteList'
import { Citation } from '../utils/citationExtension'
import { FocusFormatToolbar } from './FocusFormatToolbar'
import { FocusOutlineRail } from './FocusOutlineRail'
import { SCI_PHRASES, SCI_WORDS, type SciPhrase, type SciSection } from '../data/sci-vocab'
import type {
  AnnotationAuthor,
  AnnotationStatus,
  Article,
  BlockAnnotation,
  ContentBlock,
  Section,
  SectionType,
} from '../types'
import { normalizeContentForEditor, stripHtml } from '../utils/htmlContent'

export interface FocusModeEditorProps {
  article: Article
  section: Section
  block: ContentBlock | null
  annotations: BlockAnnotation[]
  onSave: (content: string, description: string) => Promise<void>
  onAddAnnotation: (payload: {
    anchorText: string
    comment: string
    author: AnnotationAuthor
  }) => Promise<void>
  onUpdateAnnotation: (
    id: string,
    patch: { comment?: string; status?: AnnotationStatus },
  ) => Promise<void>
  onDeleteAnnotation: (id: string) => Promise<void>
  onOpenAi: () => void
  /** Close the overlay. Esc and the explicit "退出" button both call this.
   *  Owner is expected to flip its writing-mode flag back to "preview". */
  onExit: () => void
  /** Persist a snapshot of the current block content. Called on Esc / exit and
   *  the 30-minute interval. Owner wires it
   *  to window.scipaper.recordBlockVersion. */
  onRecordVersion?: (changeDescription: string) => Promise<void>
  /** Today's writing total + daily goal — feeds the footer goal mini-bar
   *  (design pack §④ status row). Both optional; when omitted the footer
   *  falls back to per-doc word/char counts only. */
  todayWords?: number
  dailyGoal?: number
  pomodoroToday?: number
  onAddPomodoro?: (duration: number) => Promise<void>
  // ---- Pre-aggregated autocomplete dictionary (sprint 15 / commit 4) ---
  // App.tsx merges enabled vocab packs + the legacy customVocab user pack
  // into a per-IMRaD-section view here. When omitted (e.g. unit tests)
  // we fall back to the legacy SCI_WORDS / SCI_PHRASES union.
  mergedWords?: Record<SciSection, string[]>
  mergedPhrases?: Record<SciSection, SciPhrase[]>
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved'

// ---- Font picker --------------------------------------------------------
// CLAUDE_DESIGN: list curated stacks rather than letting the user type
// arbitrary font-family strings. All stacks degrade gracefully on machines
// missing the primary font.
const FONT_OPTIONS: { id: string; label: string; stack: string }[] = [
  { id: 'default', label: '默认（跟随主题）', stack: '' },
  { id: 'serif-en', label: '英文衬线 · Iowan / Palatino', stack: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif" },
  { id: 'serif-zh', label: '中文衬线 · 思源宋体', stack: "'Source Han Serif SC', 'Songti SC', 'Iowan Old Style', serif" },
  { id: 'sans-en', label: '英文无衬线 · Inter', stack: "Inter, 'Avenir Next', 'Segoe UI', system-ui, sans-serif" },
  { id: 'sans-zh', label: '中文无衬线 · 思源黑体', stack: "'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { id: 'georgia', label: 'Georgia 经典', stack: "Georgia, 'Iowan Old Style', serif" },
  { id: 'mono', label: '等宽 · IBM Plex Mono', stack: "'IBM Plex Mono', 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace" },
  { id: 'system', label: '系统默认', stack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
]
const FONT_STORAGE_KEY = 'scipaper.focusFont'
function readInitialFontId(): string {
  if (typeof window === 'undefined') return 'default'
  try {
    const saved = window.localStorage.getItem(FONT_STORAGE_KEY)
    if (saved && FONT_OPTIONS.some((f) => f.id === saved)) return saved
  } catch {
    // Ignore saved font preference read failures.
  }
  return 'default'
}

// ---- Font size picker --------------------------------------------------
const FONT_SIZE_OPTIONS: { id: string; label: string; px: number }[] = [
  { id: 'sm', label: '小', px: 14 },
  { id: 'md', label: '中', px: 16 },
  { id: 'lg', label: '大', px: 19 },
  { id: 'xl', label: '特大', px: 22 },
  { id: 'xxl', label: '巨大', px: 26 },
]
const FONT_SIZE_STORAGE_KEY = 'scipaper.focusFontSize'
function readInitialFontSizeId(): string {
  if (typeof window === 'undefined') return 'md'
  try {
    const saved = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY)
    if (saved && FONT_SIZE_OPTIONS.some((f) => f.id === saved)) return saved
  } catch {
    // Ignore saved font-size preference read failures.
  }
  return 'md'
}

// 30-minute auto snapshot interval. Combined with on-enter and on-exit
// snapshots (and storage-side max 3 cap), this caps version churn while
// preserving sensible recovery points.
const AUTO_SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000

const EMPTY_AUTOCOMPLETE: AutocompleteState = {
  active: false,
  from: 0,
  to: 0,
  query: '',
  items: [],
  selectedIndex: 0,
  coords: null,
  dismissed: false,
}

interface EditorStats {
  wordCount: number
  charCount: number
}

function countTextStats(text: string): EditorStats {
  const trimmed = text.trim()
  return {
    wordCount: trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0,
    charCount: text.length,
  }
}

function statsFromEditor(editor: Editor): EditorStats {
  const wordsText = editor.getText({ blockSeparator: ' ' })
  return {
    ...countTextStats(wordsText),
    charCount: editor.getText().length,
  }
}

function statsFromHtml(html: string | undefined): EditorStats {
  return countTextStats(stripHtml(normalizeContentForEditor(html)))
}

const AnnotationHighlight = Highlight.extend({
  addAttributes() {
    return {
      annotationId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-annotation-id'),
        renderHTML: (attrs) =>
          attrs.annotationId ? { 'data-annotation-id': attrs.annotationId } : {},
      },
      author: {
        default: 'user',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-author') || 'user',
        renderHTML: (attrs) => ({ 'data-author': attrs.author || 'user' }),
      },
      status: {
        default: 'open',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-status') || 'open',
        renderHTML: (attrs) => ({ 'data-status': attrs.status || 'open' }),
      },
    }
  },
})

function sectionTypeToSciSection(t: SectionType): SciSection {
  switch (t) {
    case 'Introduction':
      return 'introduction'
    case 'MaterialsAndMethods':
      return 'methods'
    case 'Results':
      return 'results'
    case 'Discussion':
      return 'discussion'
    default:
      return 'general'
  }
}

function findFirstAnchor(editor: Editor, needle: string): { from: number; to: number } | null {
  if (!needle) return null
  let result: { from: number; to: number } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (result) return false
    if (!node.isText) return true
    const text = node.text || ''
    const idx = text.indexOf(needle)
    if (idx >= 0) {
      result = { from: pos + idx, to: pos + idx + needle.length }
      return false
    }
    return true
  })
  return result
}

function applyHighlightsForAnnotations(editor: Editor, annotations: BlockAnnotation[]) {
  const markType = editor.state.schema.marks.highlight
  if (!markType) return
  const tr = editor.state.tr.removeMark(0, editor.state.doc.content.size, markType)
  for (const ann of annotations) {
    const range = findFirstAnchor(editor, ann.anchorText)
    if (!range) continue
    const mark = markType.create({
      annotationId: ann.id,
      author: ann.author,
      status: ann.status,
    })
    tr.addMark(range.from, range.to, mark)
  }
  if (tr.steps.length > 0) {
    tr.setMeta('addToHistory', false)
    editor.view.dispatch(tr)
  }
}

interface DraftState {
  anchorText: string
  comment: string
  aiPending: boolean
  authorWhenSaved: AnnotationAuthor
}

const POMODORO_DURATIONS = [15, 25, 45]

function formatFocusTimer(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const FocusPomodoroControls = memo(function FocusPomodoroControls({
  todaySessions = 0,
  onAddPomodoro,
}: {
  todaySessions?: number
  onAddPomodoro?: (duration: number) => Promise<void>
}) {
  const [duration, setDuration] = useState(25)
  const [remainingSec, setRemainingSec] = useState(25 * 60)
  const [phase, setPhase] = useState<'idle' | 'running' | 'paused'>('idle')
  const onAddPomodoroRef = useRef(onAddPomodoro)
  useEffect(() => { onAddPomodoroRef.current = onAddPomodoro }, [onAddPomodoro])

  useEffect(() => {
    if (phase !== 'running') return
    const timer = window.setInterval(() => {
      setRemainingSec((prev) => {
        const next = Math.max(0, prev - 1)
        if (next === 0) {
          window.clearInterval(timer)
          setPhase('idle')
          void onAddPomodoroRef.current?.(duration)
          return duration * 60
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase, duration])

  function chooseDuration(nextDuration: number) {
    if (phase !== 'idle') return
    setDuration(nextDuration)
    setRemainingSec(nextDuration * 60)
  }

  function start() {
    setRemainingSec(duration * 60)
    setPhase('running')
  }

  function stop() {
    setRemainingSec(duration * 60)
    setPhase('idle')
  }

  const progress = 1 - remainingSec / (duration * 60)

  return (
    <div
      className={`focus-mode-pomo-controls${phase !== 'idle' ? ' is-running' : ''}${phase === 'paused' ? ' is-paused' : ''}`}
      style={{ ['--p' as never]: progress } as React.CSSProperties}
      aria-label="番茄钟"
    >
      <span className="focus-mode-pomo-ring" aria-hidden />
      <span className="focus-mode-pomo-time">
        {phase === 'idle' ? `${duration}:00` : formatFocusTimer(remainingSec)}
      </span>
      {phase === 'idle' ? (
        <span className="focus-mode-pomo-presets" role="group" aria-label="选择时长">
          {POMODORO_DURATIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={`focus-mode-pomo-chip${duration === item ? ' is-active' : ''}`}
              onClick={() => chooseDuration(item)}
            >
              {item}
            </button>
          ))}
          <button type="button" className="focus-mode-pomo-action" onClick={start}>
            开始
          </button>
        </span>
      ) : (
        <span className="focus-mode-pomo-presets">
          <button
            type="button"
            className="focus-mode-pomo-action"
            onClick={() => setPhase((prev) => (prev === 'paused' ? 'running' : 'paused'))}
          >
            {phase === 'paused' ? '继续' : '暂停'}
          </button>
          <button type="button" className="focus-mode-pomo-chip" onClick={stop}>
            停
          </button>
        </span>
      )}
      <span className="focus-mode-pomo-today">今 {todaySessions}</span>
    </div>
  )
})

export const FocusModeEditor = memo(function FocusModeEditor({
  article,
  section,
  block,
  annotations,
  onSave,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onOpenAi,
  onExit,
  onRecordVersion,
  mergedWords,
  mergedPhrases,
  todayWords,
  dailyGoal,
  pomodoroToday,
  onAddPomodoro,
}: FocusModeEditorProps) {
  const [description, setDescription] = useState(block?.description ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [scrolled, setScrolled] = useState(false)
  const [selection, setSelection] = useState<{ text: string; empty: boolean }>({
    text: '',
    empty: true,
  })
  const [editorStats, setEditorStats] = useState<EditorStats>(() => statsFromHtml(block?.content))
  const canvasRef = useRef<HTMLElement>(null)
  const scrolledRef = useRef(false)
  const scrollFrameRef = useRef<number | null>(null)
  const fontId = useMemo(() => readInitialFontId(), [])
  const fontSizeId = useMemo(() => readInitialFontSizeId(), [])
  const [toolbarCollapsed, setToolbarCollapsed] = useState<boolean>(false)
  const [autocompleteState, setAutocompleteState] = useState<AutocompleteState>(EMPTY_AUTOCOMPLETE)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [draftError, setDraftError] = useState('')
  const draftRef = useRef<DraftState | null>(null)
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  // Scroll-aware topbar: the design pack draws a hairline only after the
  // canvas scrolls past 8px. Listening on the canvas (not window) keeps it
  // independent of any outer scroll containers the article view introduces.
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const updateScrolled = () => {
      scrollFrameRef.current = null
      const next = el.scrollTop > 8
      if (scrolledRef.current === next) return
      scrolledRef.current = next
      setScrolled(next)
    }
    const onScroll = () => {
      if (scrollFrameRef.current !== null) return
      scrollFrameRef.current = window.requestAnimationFrame(updateScrolled)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    updateScrolled()
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }
    }
  }, [])

  // Lock body scroll while the overlay is up — guarantees no background
  // scroll bleeds through. Mirrors the modal-overlay convention.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('focus-mode-active')
    return () => {
      document.body.style.overflow = prev
      document.body.classList.remove('focus-mode-active')
    }
  }, [])

  const fontStack = FONT_OPTIONS.find((f) => f.id === fontId)?.stack || ''
  const fontSizePx = FONT_SIZE_OPTIONS.find((f) => f.id === fontSizeId)?.px ?? 16
  const saveTimerRef = useRef<number | null>(null)
  const closingRef = useRef(false)
  const lastSavedTextRef = useRef(block?.content ?? '')
  const lastSavedDescRef = useRef(block?.description ?? '')
  // 防止 unmount 后旧 onSave promise resolve 时仍调 setSaveState 触发
  // React "set state on unmounted component" warning。所有 async setState
  // 都先看 mountedRef.current。
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  function safeSetSaveState(value: SaveState) {
    if (mountedRef.current) setSaveState(value)
  }

  const currentSciSection = sectionTypeToSciSection(section.type)

  const initialContent = useMemo(() => normalizeContentForEditor(block?.content), [block?.id])
  const annotationSignature = useMemo(
    () =>
      annotations
        .map((a) => `${a.id}\u001f${a.anchorText}\u001f${a.author}\u001f${a.status}`)
        .join('\u001e'),
    [annotations],
  )
  const openAnnotationCount = useMemo(
    () => annotations.reduce((count, annotation) => count + (annotation.status === 'open' ? 1 : 0), 0),
    [annotationSignature],
  )

  function updateEditorStats(ed: Editor) {
    const next = statsFromEditor(ed)
    setEditorStats((prev) =>
      prev.wordCount === next.wordCount && prev.charCount === next.charCount ? prev : next,
    )
  }

  function scheduleSave(html: string, desc: string) {
    if (html === lastSavedTextRef.current && desc === lastSavedDescRef.current) {
      return
    }
    // Empty doc safety: TipTap emits "<p></p>" for blank content. Don't open
    // a brand-new block from that — the user hasn't typed anything yet.
    if (!block && !stripHtml(html).trim()) {
      return
    }
    safeSetSaveState('dirty')
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(async () => {
      safeSetSaveState('saving')
      try {
        await onSave(html, desc)
        lastSavedTextRef.current = html
        lastSavedDescRef.current = desc
        safeSetSaveState('saved')
        // Quietly fade back to idle after a short beat — no flashing text.
        window.setTimeout(
          () => mountedRef.current && setSaveState((prev) => (prev === 'saved' ? 'idle' : prev)),
          900,
        )
      } catch {
        safeSetSaveState('dirty')
      }
    }, 1000)
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        link: false,
      }),
      Placeholder.configure({
        placeholder: '开始写……',
        emptyEditorClass: 'is-editor-empty',
      }),
      AnnotationHighlight.configure({ multicolor: true }),
      Citation,
      Link.configure({
        // Open external links in the OS browser through Electron, not in
        // Electron's renderer (would replace the app window). The actual
        // open handler lives at app boot; here we just disable inline open.
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      AutocompleteExtension.configure({
        getSection: () => currentSciSection,
        onStateChange: setAutocompleteState,
        // App.tsx feeds the per-pack-merged dictionary; SCI_WORDS /
        // SCI_PHRASES are the legacy fallback (union of every built-in
        // pack including default-off ones — only used in the absence of
        // a real merged view).
        words: mergedWords ?? SCI_WORDS,
        phrases: mergedPhrases ?? SCI_PHRASES,
        // `@` trigger reads the live article.citations array. Updates land
        // through the prop, so this closure always sees the latest.
        getCitations: () => article.citations ?? [],
      }),
    ],
    content: initialContent,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'focus-mode-prose',
        spellcheck: 'false',
      },
    },
    onUpdate: ({ editor: ed }) => {
      // HTML save: preserves headings, marks, and inline citation nodes
      // through a save/load roundtrip. Word-count UI calls stripHtml.
      const html = ed.getHTML()
      updateEditorStats(ed)
      scheduleSave(html, description)
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to, empty } = ed.state.selection
      const text = empty ? '' : ed.state.doc.textBetween(from, to, '\n\n', ' ')
      setSelection((prev) => (prev.empty === empty && prev.text === text ? prev : { text, empty }))
    },
  })

  // Re-anchor inline highlights when annotations change.
  useEffect(() => {
    if (!editor) return
    applyHighlightsForAnnotations(editor, annotations)
  }, [editor, annotationSignature])

  // Sync external block.content changes into the editor (e.g. AI tool call
  // wrote new content via update_text_block). Without this, the editor keeps
  // showing stale local state. Compare against last-saved snapshot so we
  // don't fight our own debounced save loop.
  // Dirty guard: 用户正在输入未保存编辑时，外部覆盖会抹掉打字内容。
  // 此时 currentText !== lastSavedText（用户在改），跳过同步，保住正在写的字。
  // 用户的下一次防抖保存会把内容写回 → 后续外部更新经由正常 flow 拉取。
  useEffect(() => {
    if (!editor || !block) return
    const incoming = block.content ?? ''
    if (incoming === lastSavedTextRef.current) return
    const currentHtml = editor.getHTML()
    if (currentHtml === incoming) return
    if (currentHtml !== lastSavedTextRef.current) {
      // Editor 处于 dirty 状态：用户正在打字，不要用外部内容覆盖
      return
    }
    editor.commands.setContent(normalizeContentForEditor(incoming))
    lastSavedTextRef.current = incoming
    updateEditorStats(editor)
    // Re-apply highlight marks because setContent wipes them.
    applyHighlightsForAnnotations(editor, annotations)
  }, [editor, block?.content])

  // Description auto-save debouncer (separate from editor.onUpdate path).
  useEffect(() => {
    if (!editor) return
    if (description === lastSavedDescRef.current) return
    const html = editor.getHTML()
    scheduleSave(html, description)
  }, [description, editor])

  // Single-block-per-section policy: no prev/next/list controls. Force any
  // pending debounced save to flush before exit-related transitions.
  // Without this, fast prev/next clicks could drop the last second of typing.
  async function flushPendingSave() {
    if (!editor) return
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const html = editor.getHTML()
    if (html === lastSavedTextRef.current && description === lastSavedDescRef.current) {
      return
    }
    if (!block && !stripHtml(html).trim()) return
    safeSetSaveState('saving')
    try {
      await onSave(html, description)
      lastSavedTextRef.current = html
      lastSavedDescRef.current = description
      safeSetSaveState('saved')
    } catch {
      safeSetSaveState('dirty')
    }
  }

  // ---- Snapshot on unmount (catches "click another tab" exits) ----------
  // Esc handles the keyboard path; this catches the "user navigated away by
  // clicking" path. Refs ensure we always flush the latest content even after
  // the closures captured by other effects have gone stale.
  const flushPendingSaveRef = useRef<() => Promise<void>>(async () => {})
  const onRecordVersionRef = useRef(onRecordVersion)
  useEffect(() => {
    onRecordVersionRef.current = onRecordVersion
  }, [onRecordVersion])

  // ---- Snapshot on block entry + every 30 minutes -----------------------
  // Snapshot policy (per user 2026-05-03):
  //   - On block entry (mount or block.id change) — captures baseline.
  //   - Every 30 minutes of continued editing.
  //   - On exit / Esc — already wired below.
  // updateTextBlock no longer writes per-edit versions, and storage caps the
  // list at 3 (oldest auto-evicted). Storage also de-dupes when latest snapshot
  // equals current content, so no-op enter snapshots cost nothing.
  useEffect(() => {
    flushPendingSaveRef.current = flushPendingSave
  })
  // CRITICAL: deps must be only `block?.id`. Including `onRecordVersion`
  // would refire this effect on every parent render (App.tsx passes an inline
  // arrow), which would record a snapshot per keystroke as autosave triggers
  // re-renders. The ref pattern keeps the latest recorder accessible without
  // making the effect unstable.
  useEffect(() => {
    if (!block) return
    const recorder = onRecordVersionRef.current
    if (recorder) {
      void recorder('进入快照').catch(() => {
        // Snapshot failures should not block editor entry.
      })
    }
    const handle = window.setInterval(() => {
      void (async () => {
        await flushPendingSaveRef.current()
        try { await onRecordVersionRef.current?.('30 分钟自动快照') } catch {
          // Snapshot failures are non-fatal.
        }
      })()
    }, AUTO_SNAPSHOT_INTERVAL_MS)
    return () => {
      window.clearInterval(handle)
      const exitRecorder = onRecordVersionRef.current
      if (!exitRecorder) return
      void (async () => {
        try { await flushPendingSaveRef.current() } catch {
          // Best-effort save on editor exit.
        }
        try { await exitRecorder('退出快照') } catch {
          // Snapshot failures are non-fatal.
        }
      })()
    }
  }, [block?.id])

  // ---- Esc to exit ---------------------------------------------------------
  // Esc snapshots current content + closes the overlay. Esc still defers to
  // autocomplete and any modal with keyboard ownership.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || closingRef.current) return
      // Don't exit while user is composing (IME pinyin / kana). Esc cancels
      // the IME selection — that's a legitimate keystroke for them.
      if (event.isComposing || event.keyCode === 229) return
      if (autocompleteState.active) return
      if (draft && document.activeElement === draftTextareaRef.current) return
      // If a modal (wizard, approval dialog, etc.) is open, let it own Esc.
      // Without this guard, opening ArticleWizard while in edit mode and
      // pressing Esc closes the wizard AND exits the editor in one keystroke.
      if (typeof document !== 'undefined' && document.querySelector('.modal-overlay')) return
      event.preventDefault()
      closingRef.current = true
      void (async () => {
        await flushPendingSave()
        if (onRecordVersion) {
          try { await onRecordVersion('Esc 快照') } catch {
            // Snapshot failures should not trap Esc exit.
          }
        }
        onExit()
      })()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, onRecordVersion, autocompleteState.active, draft])

  useEffect(() => {
    if (selection.empty || !selection.text.trim() || !block) return
    setDraft((prev) => {
      if (prev?.aiPending) return prev
      if (prev) return { ...prev, anchorText: selection.text }
      return {
        anchorText: selection.text,
        comment: '',
        aiPending: false,
        authorWhenSaved: 'user',
      }
    })
  }, [selection.empty, selection.text, block])

  function discardDraft() {
    setDraft(null)
    setDraftError('')
  }

  async function saveDraft() {
    const current = draftRef.current
    if (!current || !current.comment.trim()) return
    setDraftError('')
    try {
      await onAddAnnotation({
        anchorText: current.anchorText,
        comment: current.comment.trim(),
        author: current.authorWhenSaved,
      })
      setDraft(null)
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : String(error))
    }
  }

  async function fireAiAnnotation() {
    const current = draftRef.current
    if (!current || !editor || !block) return
    const { from, to } = editor.state.selection
    const docSize = editor.state.doc.content.size
    const contextBefore = editor.state.doc.textBetween(Math.max(0, from - 240), from, '\n\n', ' ')
    const contextAfter = editor.state.doc.textBetween(to, Math.min(docSize, to + 240), '\n\n', ' ')
    setDraft((prev) => (prev ? { ...prev, aiPending: true, authorWhenSaved: 'ai' } : prev))
    setDraftError('')
    try {
      const result = await window.scipaper.annotateText({
        sectionType: section.type,
        anchorText: current.anchorText,
        contextBefore,
        contextAfter,
        articleLanguage: article.language === 'zh' ? 'zh' : 'en',
      })
      const comment = (result?.comment || '').trim()
      if (draftRef.current?.anchorText !== current.anchorText) return
      if (!comment) {
        setDraft((prev) => (prev ? { ...prev, aiPending: false } : prev))
        setDraftError('AI 返回空内容')
        return
      }
      try {
        await onAddAnnotation({
          anchorText: current.anchorText,
          comment,
          author: 'ai',
        })
        setDraft(null)
      } catch (saveErr) {
        setDraft((prev) => (prev ? { ...prev, aiPending: false, comment } : prev))
        setDraftError(saveErr instanceof Error ? saveErr.message : String(saveErr))
      }
    } catch (error) {
      setDraft((prev) => (prev ? { ...prev, aiPending: false } : prev))
      setDraftError(error instanceof Error ? error.message : String(error))
    }
  }

  async function handleToggleStatus(id: string, current: AnnotationStatus) {
    try {
      await onUpdateAnnotation(id, { status: current === 'open' ? 'resolved' : 'open' })
    } catch (error) {
      console.error('Failed to update annotation', error)
    }
  }

  async function handleDeleteAnnotation(id: string) {
    try {
      await onDeleteAnnotation(id)
    } catch (error) {
      console.error('Failed to delete annotation', error)
    }
  }

  function jumpToAnnotation(annotation: BlockAnnotation) {
    if (!editor) return
    const range = findFirstAnchor(editor, annotation.anchorText)
    if (!range) return
    editor.commands.focus()
    editor.commands.setTextSelection(range)
  }

  const docWordCount = editorStats.wordCount
  const docCharCount = editorStats.charCount

  // Last-edited string for the canvas byline — matches the design pack's
  // "Draft v7 · authors · last edited 14:22" rhythm. Falls back to "新草稿"
  // for an unsaved block so the byline stays present and consistent.
  const lastEditedLabel = (() => {
    const ts = block?.updatedAt || article.updatedAt
    if (!ts) return '新草稿'
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(ts))
    } catch {
      return '草稿'
    }
  })()

  const goalPct = dailyGoal && dailyGoal > 0 && typeof todayWords === 'number'
    ? Math.min(100, Math.round((todayWords / dailyGoal) * 100))
    : null
  return createPortal(
    <div
      className={`focus-mode-overlay focus-mode-shell ${scrolled ? 'is-scrolled' : ''}`}
      data-focus-mode
      role="dialog"
      aria-modal="true"
      aria-label="沉浸式写作"
    >
      <header className={`focus-mode-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="focus-mode-header-side">
          <button
            type="button"
            className="focus-mode-exit"
            onClick={() => {
              closingRef.current = true
              void (async () => {
                await flushPendingSave()
                if (onRecordVersion) {
                  try { await onRecordVersion('退出快照') } catch {
                    // Snapshot failures should not block exit.
                  }
                }
                onExit()
              })()
            }}
            title="退出沉浸写作 (Esc)"
            aria-label="退出沉浸写作"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>退出</span>
          </button>
          <nav className="focus-mode-crumb" aria-label="位置">
            <span className="focus-mode-crumb-article">{article.title}</span>
            <span className="focus-mode-crumb-sep">/</span>
            <span className="focus-mode-section-tag">§ {section.type}</span>
          </nav>
        </div>
        <div className="focus-mode-header-center">
          <SaveDot state={saveState} />
          <span className="focus-mode-save-label">
            {saveState === 'saving' ? '保存中' : saveState === 'dirty' ? '未保存' : saveState === 'saved' ? '已保存' : '就绪'}
          </span>
          <FocusPomodoroControls
            todaySessions={pomodoroToday}
            onAddPomodoro={onAddPomodoro}
          />
        </div>
        <div className="focus-mode-header-side focus-mode-header-side--right">
          <button
            type="button"
            className="focus-mode-icon-button"
            onClick={() => {
              canvasRef.current
                ?.querySelector('.focus-mode-outline-tick.is-active, .focus-mode-outline-tick')
                ?.scrollIntoView({ block: 'center' })
            }}
            title="章节大纲"
            aria-label="章节大纲"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
          <button
            type="button"
            className={`focus-mode-icon-button${!toolbarCollapsed ? ' is-active' : ''}`}
            onClick={() => setToolbarCollapsed((v) => !v)}
            aria-pressed={!toolbarCollapsed}
            title={toolbarCollapsed ? '展开格式工具条' : '收起格式工具条'}
            aria-label="格式工具条"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 7h18M3 12h18M3 17h18" />
            </svg>
          </button>
          <button
            type="button"
            className="focus-mode-icon-button"
            onClick={onOpenAi}
            title="AI 助手"
            aria-label="AI 助手"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
            </svg>
          </button>
          <button
            type="button"
            className="focus-mode-icon-button"
            title="写作设置"
            aria-label="写作设置"
            onClick={() => setToolbarCollapsed(false)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
        </div>
      </header>

      <FocusFormatToolbar editor={editor} collapsed={toolbarCollapsed} />

      <div className="focus-mode-stage">
        <main
          ref={canvasRef}
          className="focus-mode-canvas"
          style={
            {
              ...(fontStack ? { ['--focus-font-override' as never]: fontStack } : {}),
              ['--focus-font-size' as never]: `${fontSizePx}px`,
            } as React.CSSProperties
          }
        >
          <div className="focus-mode-canvas-pane focus-mode-canvas-pane--editor">
            <header className="focus-mode-canvas-hero">
              <p className="focus-mode-canvas-eyebrow">§ {section.type}</p>
              <h1 className="focus-mode-canvas-title">{article.title}</h1>
              <p className="focus-mode-canvas-byline">
                <span>草稿 · {block ? `${block.versions?.length ?? 0} 个快照` : '未保存'}</span>
                <span className="focus-mode-canvas-byline-sep">·</span>
                <span>last edited {lastEditedLabel}</span>
              </p>
            </header>
            <input
              className="focus-mode-block-name"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="给这一段起个名字（可留空）"
              aria-label="段落备注"
            />
            <EditorContent editor={editor} className="focus-mode-editor-host" />
            <FocusOutlineRail editor={editor} canvasRef={canvasRef} />
          </div>
        </main>
      </div>

      {(draft || annotations.length > 0) ? (
        <aside
          className={`focus-mode-annotation-dock${draft ? ' is-open' : ''}${annotations.length > 0 ? ' has-annotations' : ''}`}
          aria-label="批注"
        >
          {draft ? (
            <section className="focus-mode-rail-section focus-mode-rail-section--draft">
              <header className="focus-mode-rail-header">
                <h3>新批注</h3>
                <button
                  type="button"
                  className="focus-mode-rail-close"
                  onClick={discardDraft}
                  aria-label="放弃这条草稿"
                  title="放弃"
                >
                  ×
                </button>
              </header>
              <blockquote className="focus-mode-draft-anchor-inline">
                {draft.anchorText.length > 120
                  ? `${draft.anchorText.slice(0, 120)}...`
                  : draft.anchorText}
              </blockquote>
              <textarea
                ref={draftTextareaRef}
                className="focus-mode-draft-textarea-inline"
                value={draft.comment}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, comment: e.target.value } : prev))
                }
                placeholder={draft.aiPending ? 'AI 正在思考中... 你可以继续写正文' : '写下你的想法'}
                disabled={draft.aiPending}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    void saveDraft()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    e.stopPropagation()
                    discardDraft()
                  }
                }}
              />
              {draftError ? (
                <div className="focus-mode-draft-error-inline" role="alert">
                  {draftError}
                </div>
              ) : null}
              <div className="focus-mode-draft-actions-inline">
                <button
                  type="button"
                  className="focus-mode-draft-button focus-mode-draft-button--ghost"
                  onClick={() => void fireAiAnnotation()}
                  disabled={draft.aiPending}
                  title="AI 在后台思考，不会打断你写正文"
                >
                  {draft.aiPending ? 'AI 思考中...' : '让 AI 批注'}
                </button>
                <button
                  type="button"
                  className="focus-mode-draft-button"
                  onClick={() => void saveDraft()}
                  disabled={!draft.comment.trim() || draft.aiPending}
                >
                  保存
                </button>
              </div>
            </section>
          ) : null}

          <section className="focus-mode-rail-section focus-mode-rail-section--annotations">
            <header className="focus-mode-rail-header">
              <h3>批注</h3>
              <span className="focus-mode-rail-count">
                {openAnnotationCount}/{annotations.length}
              </span>
            </header>
            {annotations.length === 0 ? (
              <p className="focus-mode-rail-empty">
                {block ? '选中正文里的句子开始批注。' : '先打几个字、自动保存后才能批注。'}
              </p>
            ) : (
              <ul className="focus-mode-annotation-list">
                {annotations.map((annotation) => (
                  <li
                    key={annotation.id}
                    className={`focus-mode-annotation focus-mode-annotation--${annotation.status} focus-mode-annotation--${annotation.author}`}
                  >
                    <button
                      type="button"
                      className="focus-mode-annotation-anchor"
                      onClick={() => jumpToAnnotation(annotation)}
                      title="跳到正文位置"
                    >
                      {annotation.anchorText.length > 80
                        ? `${annotation.anchorText.slice(0, 80)}...`
                        : annotation.anchorText}
                    </button>
                    <p className="focus-mode-annotation-body">
                      <span className="focus-mode-annotation-author">
                        {annotation.author === 'ai' ? 'AI' : '你'}：
                      </span>
                      {annotation.comment}
                    </p>
                    <div className="focus-mode-annotation-actions">
                      <button
                        type="button"
                        onClick={() => void handleToggleStatus(annotation.id, annotation.status)}
                      >
                        {annotation.status === 'open' ? '标记已处理' : '重新打开'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAnnotation(annotation.id)}
                      >
                        删除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      ) : null}

      <footer className="focus-mode-footer">
        <span className="focus-mode-footer-stat">
          <b>{docWordCount.toLocaleString()}</b> 词
        </span>
        {typeof todayWords === 'number' ? (
          <span className="focus-mode-footer-stat">
            <b>+{todayWords.toLocaleString()}</b> 今天
          </span>
        ) : null}
        <span className="focus-mode-footer-stat">{docCharCount} 字</span>
        {dailyGoal && dailyGoal > 0 && goalPct !== null ? (
          <span className="focus-mode-footer-goal" title={`今日目标 ${dailyGoal} 字`}>
            目标 {dailyGoal.toLocaleString()}
            <span className="focus-mode-footer-goal-bar" aria-hidden>
              <span
                className="focus-mode-footer-goal-fill"
                style={{ width: `${goalPct}%` }}
              />
            </span>
            <span className="focus-mode-footer-goal-pct">{goalPct}%</span>
          </span>
        ) : null}
        <span className="focus-mode-footer-spacer" />
        <span className="focus-mode-footer-hint">Esc 退出 · 输入 3 字母看候选 · @ 引用</span>
      </footer>

      <AutocompleteList state={autocompleteState} />
    </div>,
    document.body,
  )
})

function SaveDot({ state }: { state: SaveState }) {
  return (
    <span
      className={`focus-mode-save-dot focus-mode-save-dot--${state}`}
      aria-label={state === 'saving' ? '保存中' : state === 'dirty' ? '未保存' : state === 'saved' ? '已保存' : ''}
    />
  )
}

// =============================================================================
// FocusModeEditor — Immersive writing surface used as the "edit" view of every
// Section tab.
//
// Layout
//   Header  — section tag · save dot · ← 预览 (when previewable) · 字体/字号
//             · 上版本 toggle · 📸 manual snapshot · ?
//   Canvas  — TipTap editor; optional 40/60 split with the previous version
//             as a read-only pane below
//   Rail    — selection draft (transient) → annotations → version history.
//             AI lives in the bottom-right drawer (single global entry point);
//             rail no longer hosts an AI section.
//
// Key UX rules
//   - "AI 评论" fires LLM in BACKGROUND. User keeps writing while it thinks.
//   - "我自己批注" opens an inline textarea right where the draft sits.
//   - Save indicator = single quiet dot.
//   - Snapshot policy: enter / 30-min interval / exit / Esc / manual 📸.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import {
  AutocompleteExtension,
  type AutocompleteState,
} from '../utils/autocompleteExtension'
import { AutocompleteList } from './AutocompleteList'
import { SCI_PHRASES, SCI_WORDS, type SciSection } from '../data/sci-vocab'
import type {
  AnnotationAuthor,
  AnnotationStatus,
  Article,
  BlockAnnotation,
  ContentBlock,
  ContentBlockVersion,
  Section,
  SectionType,
} from '../types'
import { DiffViewer } from './DiffViewer'

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
  /** Called on Esc — owner typically routes the user out of the section
   *  tab (e.g. to Outline). Inline mode has no "close" button; Esc is the
   *  only escape hatch. */
  onExit: () => void
  /** Persist a snapshot of the current block content. Called on Esc, on
   *  block switch, and from the manual "保存为版本" button. Owner wires it
   *  to window.scipaper.recordBlockVersion. */
  onRecordVersion?: (changeDescription: string) => Promise<void>
  /** Read-only view of the current section (rendered in 预览 mode).
   *  Owner builds a `<SectionEditor previewOnly />` and passes it through.
   *  Kept as a slot so this component does not have to know SectionEditor's
   *  full prop surface. */
  previewSlot?: ReactNode
  // ---- Controlled view mode (sprint 7) ---------------------------------
  // When provided, FocusModeEditor lets the parent own viewMode so external
  // affordances (e.g. clicking a text block in the preview slot) can flip
  // straight into edit mode without a second click on the toggle.
  viewMode?: 'edit' | 'preview'
  onViewModeChange?: (mode: 'edit' | 'preview') => void
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
  } catch {}
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
  } catch {}
  return 'md'
}

// ---- Rail section collapse state --------------------------------------
// Rail no longer hosts AI chat (sprint 8 — AI lives only in the bottom-right
// drawer to avoid two competing entries). Only annotations + versions left.
type RailSectionId = 'annotations' | 'versions'
const RAIL_COLLAPSE_STORAGE_KEY = 'scipaper.focusRailCollapsed'
function readInitialRailCollapse(): Record<RailSectionId, boolean> {
  const fallback: Record<RailSectionId, boolean> = {
    annotations: false,
    versions: false,
  }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(RAIL_COLLAPSE_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return {
      annotations: !!parsed.annotations,
      versions: !!parsed.versions,
    }
  } catch {
    return fallback
  }
}

// ---- Previous-version split panel -------------------------------------
// Always start closed: user has to opt in each session via the "上版本" toggle.
// Wipes the legacy localStorage entry once per session (module-level guard) so
// remounts don't repeat the I/O.
let __orphanShowPrevCleaned = false
function readInitialShowPrevVersion(): boolean {
  if (typeof window !== 'undefined' && !__orphanShowPrevCleaned) {
    try { window.localStorage.removeItem('scipaper.focusShowPrevVersion') } catch {}
    __orphanShowPrevCleaned = true
  }
  return false
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

function plainTextToHtml(text: string): string {
  if (!text) return ''
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
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
  /** Verbatim selected text snapshot, used as anchor when saved. */
  anchorText: string
  /** What the user has typed (or what AI has filled in). */
  comment: string
  /** True while a background AI request is in flight for THIS draft. */
  aiPending: boolean
  /** Source of the comment when it gets saved. */
  authorWhenSaved: AnnotationAuthor
}


export function FocusModeEditor({
  article,
  section,
  block,
  annotations,
  onSave,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onExit,
  onRecordVersion,
  previewSlot,
  viewMode: viewModeProp,
  onViewModeChange,
}: FocusModeEditorProps) {
  const [description, setDescription] = useState(block?.description ?? '')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  // viewMode is controlled when the parent passes it. Default for the
  // uncontrolled fallback is "preview" (sprint 7 — chapter tabs land in
  // preview first; clicking the manuscript flips to edit).
  const [viewModeUncontrolled, setViewModeUncontrolled] = useState<'edit' | 'preview'>('preview')
  const viewMode = viewModeProp ?? viewModeUncontrolled
  function setViewMode(next: 'edit' | 'preview') {
    if (onViewModeChange) onViewModeChange(next)
    else setViewModeUncontrolled(next)
  }
  const [selection, setSelection] = useState<{ text: string; empty: boolean }>({
    text: '',
    empty: true,
  })
  const [showHelp, setShowHelp] = useState(false)
  const [fontId, setFontId] = useState<string>(readInitialFontId)
  const [fontSizeId, setFontSizeId] = useState<string>(readInitialFontSizeId)
  const [railCollapsed, setRailCollapsed] = useState<Record<RailSectionId, boolean>>(
    readInitialRailCollapse,
  )
  const [showPrevVersion, setShowPrevVersion] = useState<boolean>(readInitialShowPrevVersion)
  const [autocompleteState, setAutocompleteState] = useState<AutocompleteState>(EMPTY_AUTOCOMPLETE)
  useEffect(() => {
    try { window.localStorage.setItem(FONT_STORAGE_KEY, fontId) } catch {}
  }, [fontId])
  useEffect(() => {
    try { window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSizeId) } catch {}
  }, [fontSizeId])
  useEffect(() => {
    try { window.localStorage.setItem(RAIL_COLLAPSE_STORAGE_KEY, JSON.stringify(railCollapsed)) } catch {}
  }, [railCollapsed])
  const fontStack = FONT_OPTIONS.find((f) => f.id === fontId)?.stack || ''
  const fontSizePx = FONT_SIZE_OPTIONS.find((f) => f.id === fontSizeId)?.px ?? 16
  function toggleRail(id: RailSectionId) {
    setRailCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }
  // Previous version = the most recent snapshot. Always show versions[0]
  // when one exists (including manual 📸 snaps) — the user's intent is "let
  // me see the last thing I saved", even if it currently equals the editor
  // content. Once they start editing the diff appears naturally.
  const prevVersion = block && block.versions && block.versions.length > 0 ? block.versions[0] : null
  const prevVersionMatchesCurrent = !!(prevVersion && block && prevVersion.content === block.content)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [draftError, setDraftError] = useState('')
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
  const draftRef = useRef<DraftState | null>(null)
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null)
  draftRef.current = draft

  const sectionRef = useRef<SciSection>(sectionTypeToSciSection(section.type))
  useEffect(() => {
    sectionRef.current = sectionTypeToSciSection(section.type)
  }, [section.type])

  const initialContent = useMemo(() => plainTextToHtml(block?.content ?? ''), [block?.id])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: '开始写……',
        emptyEditorClass: 'is-editor-empty',
      }),
      AnnotationHighlight.configure({ multicolor: true }),
      AutocompleteExtension.configure({
        getSection: () => sectionRef.current,
        onStateChange: setAutocompleteState,
        words: SCI_WORDS,
        phrases: SCI_PHRASES,
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
      const text = ed.getText({ blockSeparator: '\n\n' })
      scheduleSave(text, description)
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to, empty } = ed.state.selection
      const text = empty ? '' : ed.state.doc.textBetween(from, to, '\n\n', ' ')
      setSelection({ text, empty })
    },
  })

  // Re-anchor inline highlights when annotations change.
  useEffect(() => {
    if (!editor) return
    applyHighlightsForAnnotations(editor, annotations)
  }, [editor, annotations])

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
    const currentText = editor.getText({ blockSeparator: '\n\n' })
    if (currentText === incoming) return
    if (currentText !== lastSavedTextRef.current) {
      // Editor 处于 dirty 状态：用户正在打字，不要用外部内容覆盖
      return
    }
    editor.commands.setContent(plainTextToHtml(incoming))
    lastSavedTextRef.current = incoming
    // Re-apply highlight marks because setContent wipes them.
    applyHighlightsForAnnotations(editor, annotations)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, block?.content])

  // Description auto-save debouncer (separate from editor.onUpdate path).
  useEffect(() => {
    if (!editor) return
    if (description === lastSavedDescRef.current) return
    const text = editor.getText({ blockSeparator: '\n\n' })
    scheduleSave(text, description)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const text = editor.getText({ blockSeparator: '\n\n' })
    if (text === lastSavedTextRef.current && description === lastSavedDescRef.current) {
      return
    }
    if (!block && !text.trim()) return
    safeSetSaveState('saving')
    try {
      await onSave(text, description)
      lastSavedTextRef.current = text
      lastSavedDescRef.current = description
      safeSetSaveState('saved')
    } catch {
      safeSetSaveState('dirty')
    }
  }

  async function handleRollback(version: ContentBlockVersion) {
    if (!editor || !block) return
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    safeSetSaveState('saving')
    try {
      await onSave(version.content, description)
      lastSavedTextRef.current = version.content
      lastSavedDescRef.current = description
      editor.commands.setContent(plainTextToHtml(version.content))
      safeSetSaveState('saved')
      window.setTimeout(
        () => mountedRef.current && setSaveState((prev) => (prev === 'saved' ? 'idle' : prev)),
        900,
      )
    } catch {
      safeSetSaveState('dirty')
    }
  }

  function scheduleSave(text: string, desc: string) {
    if (text === lastSavedTextRef.current && desc === lastSavedDescRef.current) {
      return
    }
    if (!block && !text.trim()) {
      return
    }
    safeSetSaveState('dirty')
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(async () => {
      safeSetSaveState('saving')
      try {
        await onSave(text, desc)
        lastSavedTextRef.current = text
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
  //   - Manual 📸 — already wired.
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
      void recorder('进入快照').catch(() => {})
    }
    const handle = window.setInterval(() => {
      void (async () => {
        await flushPendingSaveRef.current()
        try { await onRecordVersionRef.current?.('30 分钟自动快照') } catch {}
      })()
    }, AUTO_SNAPSHOT_INTERVAL_MS)
    return () => {
      window.clearInterval(handle)
      const exitRecorder = onRecordVersionRef.current
      if (!exitRecorder) return
      void (async () => {
        try { await flushPendingSaveRef.current() } catch {}
        try { await exitRecorder('退出快照') } catch {}
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block?.id])

  // ---- Esc to exit ---------------------------------------------------------
  // Inline mode: Esc snapshots current content + calls onExit. Owner usually
  // routes the user to the Outline tab. Esc still defers to autocomplete /
  // draft if those have keyboard ownership.
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
          try { await onRecordVersion('Esc 快照') } catch {}
        }
        onExit()
      })()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExit, onRecordVersion, autocompleteState.active, draft])

  // ---- Auto-open / re-anchor draft on selection ---------------------------
  // First non-empty selection opens an empty draft. Further selections
  // re-anchor the same draft (preserving any text the user already typed).
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

  // ---- Draft actions -------------------------------------------------------
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
    const contextBefore = editor.state.doc.textBetween(
      Math.max(0, from - 240),
      from,
      '\n\n',
      ' ',
    )
    const contextAfter = editor.state.doc.textBetween(
      to,
      Math.min(docSize, to + 240),
      '\n\n',
      ' ',
    )
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
      // The user might have closed/replaced the draft while AI was thinking.
      // Only auto-save if THIS draft is still the active one.
      const stillSame = draftRef.current?.anchorText === current.anchorText
      if (!stillSame) {
        // User moved on. Drop the AI result silently — they didn't ask to wait.
        return
      }
      if (!comment) {
        setDraft((prev) =>
          prev ? { ...prev, aiPending: false } : prev,
        )
        setDraftError('AI 返回空内容')
        return
      }
      // Background-mode happy path: AI is done, persist directly without
      // waiting for the user to click save (their request was "let AI think
      // for me"). Keep the draft open only on error so they see what went wrong.
      try {
        await onAddAnnotation({
          anchorText: current.anchorText,
          comment,
          author: 'ai',
        })
        setDraft(null)
      } catch (saveErr) {
        setDraft((prev) =>
          prev ? { ...prev, aiPending: false, comment } : prev,
        )
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

  const wordCount = editor
    ? editor
        .getText({ blockSeparator: ' ' })
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
    : 0
  const charCount = editor ? editor.getText().length : 0
  const openAnnotations = annotations.filter((a) => a.status === 'open').length

  return (
    <div className="focus-mode-shell" data-focus-mode role="region" aria-label="沉浸式写作">
      <header className="focus-mode-header">
        <div className="focus-mode-header-side">
          <span className="focus-mode-section-tag">{section.type}</span>
          <span className="focus-mode-article-title">· {article.title}</span>
        </div>
        <div className="focus-mode-header-center">
          <SaveDot state={saveState} />
        </div>
        <div className="focus-mode-header-side focus-mode-header-side--right">
          {viewMode === 'edit' && previewSlot ? (
            <button
              type="button"
              className="focus-mode-icon-button"
              onClick={() => setViewMode('preview')}
              title="返回章节预览"
            >
              ← 预览
            </button>
          ) : null}
          <select
            className="focus-mode-font-select"
            value={fontId}
            onChange={(e) => setFontId(e.target.value)}
            aria-label="正文字体"
            title="正文字体"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <select
            className="focus-mode-font-select focus-mode-font-size-select"
            value={fontSizeId}
            onChange={(e) => setFontSizeId(e.target.value)}
            aria-label="正文字号"
            title="正文字号"
          >
            {FONT_SIZE_OPTIONS.map((f) => (
              <option key={f.id} value={f.id}>{f.label} ({f.px}px)</option>
            ))}
          </select>
          <button
            type="button"
            className={`focus-mode-icon-button${showPrevVersion ? ' is-active' : ''}`}
            onClick={() => setShowPrevVersion((v) => !v)}
            title={showPrevVersion ? '关闭上版本对照' : '在写作下方显示上一个版本'}
            aria-pressed={showPrevVersion}
          >
            上版本
          </button>
          {onRecordVersion ? (
            <button
              className="focus-mode-icon-button"
              type="button"
              onClick={async () => {
                await flushPendingSave()
                try { await onRecordVersion('手动快照') } catch {}
              }}
              title="把当前正文存为版本快照（不影响自动保存）"
            >
              📸
            </button>
          ) : null}
          <button
            className="focus-mode-icon-button"
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-label="键盘提示"
            title="键盘提示"
          >
            ?
          </button>
        </div>
      </header>

      <div className="focus-mode-stage is-rail-open">
        {viewMode === 'edit' ? (
          <main
            className={`focus-mode-canvas${showPrevVersion && prevVersion ? ' focus-mode-canvas--split' : ''}`}
            style={
              {
                ...(fontStack ? { ['--focus-font-override' as never]: fontStack } : {}),
                ['--focus-font-size' as never]: `${fontSizePx}px`,
              } as React.CSSProperties
            }
          >
            <div className="focus-mode-canvas-pane focus-mode-canvas-pane--editor">
              <input
                className="focus-mode-block-name"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="给这一段起个名字（可留空）"
                aria-label="段落备注"
              />
              <EditorContent editor={editor} className="focus-mode-editor-host" />
            </div>
            {showPrevVersion && prevVersion ? (
              <>
                <div
                  className="focus-mode-canvas-divider"
                  role="separator"
                  aria-label="上版本分割线"
                />
                <div className="focus-mode-canvas-pane focus-mode-canvas-pane--prev">
                  <header className="focus-mode-prev-header">
                    <span className="focus-mode-prev-label">
                      上一个版本 · {prevVersion.changeDescription || '快照'} ·{' '}
                      {new Date(prevVersion.modifiedAt).toLocaleString()}
                      {prevVersionMatchesCurrent ? ' · 与当前一致' : ''}
                    </span>
                    <button
                      type="button"
                      className="focus-mode-prev-close"
                      onClick={() => setShowPrevVersion(false)}
                      aria-label="关闭上版本预览"
                      title="关闭"
                    >
                      ×
                    </button>
                  </header>
                  <pre className="focus-mode-prev-body">{prevVersion.content || '（空）'}</pre>
                </div>
              </>
            ) : null}
          </main>
        ) : (
          <main className="focus-mode-canvas focus-mode-canvas--preview">
            <div className="focus-mode-preview-host">
              {previewSlot ?? (
                <p className="focus-mode-rail-empty">暂无预览。</p>
              )}
            </div>
          </main>
        )}

        <aside className="focus-mode-rail">
          {/* ---- Draft area (top) ----------------------------------------- */}
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
                  ? `${draft.anchorText.slice(0, 120)}…`
                  : draft.anchorText}
              </blockquote>
              <textarea
                ref={draftTextareaRef}
                className="focus-mode-draft-textarea-inline"
                value={draft.comment}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, comment: e.target.value } : prev))
                }
                placeholder={draft.aiPending ? 'AI 正在思考中… 你可以继续写正文' : '写下你的想法'}
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
                  ⚠ {draftError}
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
                  {draft.aiPending ? 'AI 思考中…' : '让 AI 评论'}
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

          {/* ---- Annotation list ----------------------------------------- */}
          <section
            className={`focus-mode-rail-section focus-mode-rail-section--annotations${railCollapsed.annotations ? ' is-collapsed' : ''}`}
          >
            <header className="focus-mode-rail-header">
              <button
                type="button"
                className="focus-mode-rail-toggle"
                onClick={() => toggleRail('annotations')}
                aria-expanded={!railCollapsed.annotations}
                title={railCollapsed.annotations ? '展开' : '收起'}
              >
                <span className="focus-mode-rail-chevron" aria-hidden>
                  {railCollapsed.annotations ? '▸' : '▾'}
                </span>
                <h3>批注</h3>
              </button>
              <span className="focus-mode-rail-count">
                {openAnnotations}/{annotations.length}
              </span>
            </header>
            {railCollapsed.annotations ? null : annotations.length === 0 ? (
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
                        ? `${annotation.anchorText.slice(0, 80)}…`
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

          {/* ---- Version history (DiffViewer) ---------------------------- */}
          {block && block.versions && block.versions.length > 0 ? (
            <section
              className={`focus-mode-rail-section focus-mode-rail-section--versions${railCollapsed.versions ? ' is-collapsed' : ''}`}
            >
              <header className="focus-mode-rail-header">
                <button
                  type="button"
                  className="focus-mode-rail-toggle"
                  onClick={() => toggleRail('versions')}
                  aria-expanded={!railCollapsed.versions}
                  title={railCollapsed.versions ? '展开' : '收起'}
                >
                  <span className="focus-mode-rail-chevron" aria-hidden>
                    {railCollapsed.versions ? '▸' : '▾'}
                  </span>
                  <h3>版本历史</h3>
                </button>
                <span className="focus-mode-rail-count">{block.versions.length}</span>
              </header>
              {railCollapsed.versions ? null : (
                <DiffViewer
                  versions={block.versions}
                  currentContent={block.content}
                  onRollback={(v) => void handleRollback(v)}
                  compact
                />
              )}
            </section>
          ) : null}

          {/* AI 助手已收回到右下角抽屉（唯一入口），不在 rail 重复展示。 */}
        </aside>
      </div>

      <footer className="focus-mode-footer">
        <span className="focus-mode-footer-stat">{wordCount} 词</span>
        <span className="focus-mode-footer-stat">{charCount} 字</span>
        <span className="focus-mode-footer-spacer" />
        <span className="focus-mode-footer-hint">Esc 退出 · 输入 3 字母看候选 · Tab 接受</span>
      </footer>

      {showHelp ? (
        <div className="focus-mode-help" role="note">
          <h4>键盘 / 操作提示</h4>
          <ul>
            <li><kbd>Esc</kbd> 退出沉浸模式（无候选弹窗时）</li>
            <li>输入 3+ 字母 → 自动弹出 SCI 词候选，<kbd>Tab</kbd>/<kbd>Enter</kbd> 接受</li>
            <li>选中正文 → 右侧自动出现批注框；点"让 AI 评论"AI 在后台思考，不打断写作</li>
            <li>批注侧栏点引文 → 光标跳到正文那段</li>
            <li>编辑后 1 秒自动保存（顶部小点闪一下）</li>
          </ul>
          <button type="button" onClick={() => setShowHelp(false)}>知道了</button>
        </div>
      ) : null}

      <AutocompleteList state={autocompleteState} />
    </div>
  )
}

function SaveDot({ state }: { state: SaveState }) {
  return (
    <span
      className={`focus-mode-save-dot focus-mode-save-dot--${state}`}
      aria-label={state === 'saving' ? '保存中' : state === 'dirty' ? '未保存' : state === 'saved' ? '已保存' : ''}
    />
  )
}

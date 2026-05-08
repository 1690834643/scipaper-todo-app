import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArticleWizard } from './components/ArticleWizard'
import { CitationManager } from './components/CitationManager'
import { OutlineView } from './components/OutlineView'
import { ResearchContextPanel } from './components/ResearchContextPanel'
import { ReviewPanel } from './components/ReviewPanel'
import { SectionEditor } from './components/SectionEditor'
import { FocusModeEditor } from './components/FocusModeEditor'
import { ThesisWizard } from './components/ThesisWizard'
import { TagManager } from './components/TagManager'
import { HomeView } from './components/HomeView'
import { LibraryView } from './components/LibraryView'
import { DailyLogView } from './components/DailyLogView'
import { SettingsView } from './components/SettingsView'
import { AppSidebar, type AppRoute } from './components/AppSidebar'
import { ArticleRightRail } from './components/ArticleRightRail'
import { AIAssistantPanel, type AssistantMessage } from './components/AIAssistantPanel'
import { ApprovalDialog } from './components/ApprovalDialog'
import { SplashScreen } from './components/SplashScreen'
import { ShareCard } from './components/ShareCard'
import { ImportAssistantModal } from './components/ImportAssistantModal'
import { ThesisDetailView } from './components/ThesisDetailView'
import { pickJoke, pickAnalogy } from './utils/jokesAndAnalogies'
import type { AnnotationAuthor, AnnotationStatus, AppState, ArticleStatus, CreateArticlePayload, CreateThesisPayload, UpdateThesisPayload, LlmPreset, LlmProvider, McpInfo, MoodType, ProgressEntryKind, SectionType, TagColor, ThemeType, WritingStats as WritingStatsType, ApprovalRequest, WritingScenario, ItalicGuide, ZoteroConfig, VocabPack, VocabPackSummary, SciSection, SciPhrase } from './types'
import { BUILTIN_PACKS, aggregatePackWords, aggregatePackPhrases } from './data/sci-vocab'
import type { BibTeXEntry } from './utils/bibtexParser'
import { ARTICLE_STATUS_LABEL_ZH, relativeTime } from './utils/articleUtils'
import { localIsoDate } from './utils/dateUtils'

const SECTION_LABELS: Record<SectionType, string> = {
  Title: '题目',
  Abstract: '摘要',
  Introduction: '前言',
  MaterialsAndMethods: '材料方法',
  Results: '结果',
  Discussion: '讨论',
  References: '参考文献',
}

// Single-char CN abbreviations + EN full names — design pack §① IMRaD rail
// dual-label treatment. Used by section-nav chips to render CN big / EN small.
const SECTION_ABBREV_CN: Record<SectionType, string> = {
  Title: '题',
  Abstract: '摘',
  Introduction: '前',
  MaterialsAndMethods: '材',
  Results: '结',
  Discussion: '讨',
  References: '参',
}
const SECTION_ABBREV_EN: Record<SectionType, string> = {
  Title: 'Title',
  Abstract: 'Abstract',
  Introduction: 'Intro',
  MaterialsAndMethods: 'Methods',
  Results: 'Results',
  Discussion: 'Discuss',
  References: 'Refs',
}

type ArticleTab = SectionType | 'ResearchContext' | 'Outline' | 'Citations' | 'Review' | 'Tags'

const ARTICLE_TOOL_TABS: { tab: ArticleTab; label: string }[] = [
  { tab: 'Outline', label: '大纲' },
  { tab: 'ResearchContext', label: '研究上下文' },
  { tab: 'Citations', label: '参考文献' },
  { tab: 'Review', label: '审稿' },
  { tab: 'Tags', label: '标签' },
]

function isSectionTab(tab: ArticleTab): tab is SectionType {
  return tab !== 'ResearchContext' && tab !== 'Outline' && tab !== 'Citations' && tab !== 'Review' && tab !== 'Tags'
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return '早上好'
  }

  if (hour < 18) {
    return '下午好'
  }

  return '晚上好'
}


const ARTICLE_STORAGE_KEY = 'scipaper.selectedArticleId'

function readSavedArticleId(): string | null {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem(ARTICLE_STORAGE_KEY) } catch { return null }
}

function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [mcpInfo, setMcpInfo] = useState<McpInfo | null>(null)
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [selectedThesisId, setSelectedThesisId] = useState<string | null>(null)
  const [articleTab, setArticleTab] = useState<ArticleTab>('Introduction')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [thesisWizardOpen, setThesisWizardOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeType>('claude')
  const [splashVisible, setSplashVisible] = useState(true)
  // While the splash is on screen, hide the rest of the app via a body class.
  // Without this, React mounts the home view first and the user sees a flash
  // of the "晚上好" greeting before the splash paints over it.
  useEffect(() => {
    if (splashVisible) document.body.classList.add('splash-active')
    else document.body.classList.remove('splash-active')
    return () => document.body.classList.remove('splash-active')
  }, [splashVisible])
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg' | 'xl'>(() => {
    if (typeof window === 'undefined') return 'md'
    try {
      const saved = window.localStorage.getItem('scipaper.fontScale')
      if (saved === 'sm' || saved === 'md' || saved === 'lg' || saved === 'xl') return saved
    } catch {
      // localStorage can be unavailable in restricted browser contexts.
    }
    return 'md'
  })
  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale
    try { window.localStorage.setItem('scipaper.fontScale', fontScale) } catch {
      // Ignore preference persistence failures.
    }
  }, [fontScale])

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem('scipaper.sidebarCollapsed') === '1' } catch { return false }
  })
  useEffect(() => {
    try { window.localStorage.setItem('scipaper.sidebarCollapsed', sidebarCollapsed ? '1' : '0') } catch {
      // Ignore preference persistence failures.
    }
  }, [sidebarCollapsed])

  const [rightRailOpen, setRightRailOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    try {
      const saved = window.localStorage.getItem('scipaper.articleRightRailOpen')
      // Default open — but respect explicit '0' (user collapsed it).
      return saved !== '0'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem('scipaper.articleRightRailOpen', rightRailOpen ? '1' : '0')
    } catch {
      // Ignore preference persistence failures.
    }
  }, [rightRailOpen])

  const [sectionNavCollapsed, setSectionNavCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem('scipaper.sectionNavCollapsed') === '1' } catch { return false }
  })
  useEffect(() => {
    try { window.localStorage.setItem('scipaper.sectionNavCollapsed', sectionNavCollapsed ? '1' : '0') } catch {
      // Ignore preference persistence failures.
    }
  }, [sectionNavCollapsed])

  const [route, setRoute] = useState<AppRoute>('home')
  const [writingStats, setWritingStats] = useState<WritingStatsType | null>(null)
  const [metaDraft, setMetaDraft] = useState({
    title: '',
    targetJournal: '',
    status: 'Drafting' as ArticleStatus,
  })

  // LLM state
  const [providers, setProviders] = useState<LlmProvider[]>([])
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null)
  const [presets, setPresets] = useState<LlmPreset[]>([])
  const [aiOpen, setAiOpen] = useState(false)
  const [importAssistantOpen, setImportAssistantOpen] = useState(false)
  const [importAssistantMode, setImportAssistantMode] = useState<'manuscript' | 'review'>('manuscript')
  const [aiMessages, setAiMessages] = useState<AssistantMessage[]>([])
  const [aiBusy, setAiBusy] = useState(false)
  const [aiToolCallCount, setAiToolCallCount] = useState(0)
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null)
  const aiSessionRef = useRef<string | null>(null)

  // Writing scenarios
  const [scenarios, setScenarios] = useState<WritingScenario[]>([])
  const [currentScenarioId, setCurrentScenarioId] = useState<string>('auto')

  // Italic guide & Zotero config
  const [italicGuide, setItalicGuide] = useState<ItalicGuide>({ prompt: '', enabled: true })
  const [zoteroConfig, setZoteroConfig] = useState<ZoteroConfig>({
    endpoint: 'http://localhost:23119',
    userId: '0',
    enabled: false,
  })

  // Auto-approve all in-app AI tool calls
  const [autoApproveTools, setAutoApproveToolsState] = useState(false)

  // Vocab pack registry — populated from IPC at startup. summaries carry
  // each pack's effective enabled state (user override or pack default);
  // customVocabPacks holds user-imported packs' full word/phrase content.
  const [vocabPackSummaries, setVocabPackSummaries] = useState<VocabPackSummary[]>(() => {
    return BUILTIN_PACKS.map((p) => ({
      id: p.id, name: p.name, description: p.description,
      builtin: true, defaultEnabled: p.defaultEnabled, enabled: p.defaultEnabled,
    }))
  })
  const [customVocabPacks, setCustomVocabPacks] = useState<VocabPack[]>([])

  // Pending Settings module focus (e.g. AI panel jumps to "AI Provider" submodule)
  const [pendingSettingsFocus, setPendingSettingsFocus] = useState<import('./components/SettingsView').SettingsModule | null>(null)

  // Section tab view mode: 'preview' (default — see images / manuscript /
  // findings) or 'edit' (immersive writing). User explicitly enters edit by
  // clicking the manuscript card in the preview. Resets to 'preview' on
  // every section-tab switch.
  const [focusViewMode, setFocusViewMode] = useState<'edit' | 'preview'>('preview')
  useEffect(() => {
    setFocusViewMode('preview')
  }, [articleTab])

  // Leaving the article route while focusViewMode is still 'edit' would carry
  // immersive collapse semantics into Home/Daily/Settings unexpectedly. Reset
  // when navigating away.
  useEffect(() => {
    if (route !== 'article') setFocusViewMode('preview')
  }, [route])

  // Single-block-per-section policy: focusBlock is derived directly from the
  // active section's first text block (created lazily on first save). No
  // focusBlockId / focusNewSection state needed any more.
  // Article header meta (title/journal/status/导出) defaults to collapsed so
  // the Section tab gets maximum vertical space for writing.
  const [metaExpanded, setMetaExpanded] = useState(false)

  // docx export template
  const [docxTemplate, setDocxTemplate] = useState<string>('academic-en')
  const [docxApplyItalic, setDocxApplyItalic] = useState(false)
  const [docxBusy, setDocxBusy] = useState(false)
  const [lastExport, setLastExport] = useState<{ kind: 'article' | 'thesis'; id: string; path: string } | null>(null)

  // Share card
  const [shareOpen, setShareOpen] = useState(false)
  const [shareJoke, setShareJoke] = useState('')

  const deferredSearch = useDeferredValue(search)
  const greeting = getGreeting()

  async function refreshStateSilently() {
    const nextState = await window.scipaper.bootstrap()
    setState(nextState)
    setWritingStats(await window.scipaper.getWritingStats())

    let articleVanished = false
    setSelectedArticleId((currentId) => {
      if (currentId && nextState.articles.some((article) => article.id === currentId)) {
        return currentId
      }
      articleVanished = true
      return nextState.articles[0]?.id ?? null
    })
    // Article was deleted externally — pivot to fallback or null. Don't drop
    // the user into immersive edit on a brand-new article they didn't open.
    // (setFocusViewMode lives outside the updater to keep the setter pure.)
    if (articleVanished) setFocusViewMode('preview')
  }

  useEffect(() => {
    async function bootstrap() {
      const [nextState, nextMcpInfo] = await Promise.all([window.scipaper.bootstrap(), window.scipaper.getMcpInfo()])

      setState(nextState)
      setMcpInfo(nextMcpInfo)
      const savedId = readSavedArticleId()
      const restoredId = savedId && nextState.articles.some((a) => a.id === savedId) ? savedId : nextState.articles[0]?.id ?? null
      setSelectedArticleId(restoredId)
    }

    bootstrap().catch((error) => {
      console.error(error)
      setNotice('初始化失败，请重启应用。')
    })
  }, [])

  useEffect(() => {
    try {
      if (selectedArticleId) {
        window.localStorage.setItem(ARTICLE_STORAGE_KEY, selectedArticleId)
      } else {
        window.localStorage.removeItem(ARTICLE_STORAGE_KEY)
      }
    } catch {
      // Ignore article selection persistence failures.
    }
  }, [selectedArticleId])

  useEffect(() => {
    async function loadThemeAndStats() {
      const [currentTheme, stats] = await Promise.all([
        window.scipaper.getTheme(),
        window.scipaper.getWritingStats()
      ])
      const legacyMap: Record<string, ThemeType> = {
        light: 'claude',
        sepia: 'claude',
        dark: 'pixel',
        green: 'fresh',
      }
      const validThemes: ThemeType[] = ['claude', 'pixel', 'fresh']
      const resolved: ThemeType = validThemes.includes(currentTheme as ThemeType)
        ? (currentTheme as ThemeType)
        : legacyMap[currentTheme as string] ?? 'claude'
      setTheme(resolved)
      if (resolved !== currentTheme) {
        await window.scipaper.setTheme(resolved)
      }
      setWritingStats(stats)
    }
    loadThemeAndStats()
  }, [])

  useEffect(() => {
    const unsubscribe = window.scipaper.onStateChanged(() => {
      refreshStateSilently().catch((error) => {
        console.error(error)
      })
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    function isInputFocused() {
      const el = document.activeElement as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }

    function handleKey(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey

      if (event.key === 'Escape') {
        if (wizardOpen) {
          setWizardOpen(false)
          event.preventDefault()
        } else if (thesisWizardOpen) {
          setThesisWizardOpen(false)
          event.preventDefault()
        }
        return
      }

      if (mod && (event.key === 'n' || event.key === 'N')) {
        if (isInputFocused()) return
        event.preventDefault()
        setWizardOpen(true)
        return
      }

      if (mod && event.key === '/') {
        if (isInputFocused()) return
        event.preventDefault()
        const order: ThemeType[] = ['claude', 'pixel', 'fresh']
        const next = order[(order.indexOf(theme) + 1) % order.length]
        handleThemeChange(next)
      }

      if (mod && (event.key === 'k' || event.key === 'K')) {
        if (isInputFocused()) return
        event.preventDefault()
        setAiOpen(true)
      }

      if (mod && (event.key === 'e' || event.key === 'E')) {
        if (isInputFocused()) return
        // Only fire when an article + section tab is active and we're not
        // already in edit mode — Cmd+E is a "jump into writing" shortcut.
        if (route === 'article' && isSectionTab(articleTab) && focusViewMode !== 'edit') {
          event.preventDefault()
          setFocusViewMode('edit')
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [theme, wizardOpen, thesisWizardOpen, route, articleTab, focusViewMode])

  // Load LLM providers on mount
  useEffect(() => {
    refreshProviders().catch((error) => console.error(error))
  }, [])

  // Load scenarios on mount
  useEffect(() => {
    refreshScenarios().catch((error) => console.error(error))
  }, [])

  // Load italic guide, zotero config, auto-approve flag on mount
  useEffect(() => {
    Promise.all([
      window.scipaper.getItalicGuide(),
      window.scipaper.getZoteroConfig(),
      window.scipaper.getAutoApproveTools(),
    ])
      .then(([italic, zotero, autoApprove]) => {
        setItalicGuide(italic)
        setZoteroConfig(zotero)
        setAutoApproveToolsState(Boolean(autoApprove))
      })
      .catch((error) => console.error(error))
  }, [])

  // Load vocab pack registry on mount. Falls back to BUILTIN_PACKS-only
  // defaults (set in initial state) if IPC is unavailable.
  useEffect(() => {
    Promise.all([
      window.scipaper.listVocabPacks(),
      window.scipaper.getCustomVocabPacks(),
    ])
      .then(([summaries, custom]) => {
        setVocabPackSummaries(summaries)
        setCustomVocabPacks(custom)
      })
      .catch((error) => console.error('vocabPacks load failed:', error))
  }, [])

  // Resolve enabled packs (builtin + custom) into the per-section dictionary
  // the autocomplete extension consumes. customVocab (legacy user-default)
  // is appended to the `general` bucket.
  const enabledPacks = useMemo<VocabPack[]>(() => {
    const enabledIds = new Set(vocabPackSummaries.filter((s) => s.enabled).map((s) => s.id))
    const builtin = BUILTIN_PACKS.filter((p) => enabledIds.has(p.id))
    const custom = customVocabPacks.filter((p) => enabledIds.has(p.id))
    return [...builtin, ...custom]
  }, [vocabPackSummaries, customVocabPacks])

  const mergedVocabWords = useMemo<Record<SciSection, string[]>>(() => {
    const out = aggregatePackWords(enabledPacks)
    const extra = state?.customVocab?.words ?? []
    if (extra.length === 0) return out
    const seen = new Set(out.general.map((w) => w.toLowerCase()))
    const general = out.general.slice()
    for (const w of extra) {
      const key = w.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      general.push(w)
    }
    return { ...out, general }
  }, [enabledPacks, state?.customVocab])

  const mergedVocabPhrases = useMemo<Record<SciSection, SciPhrase[]>>(() => {
    const out = aggregatePackPhrases(enabledPacks)
    const extra = state?.customVocab?.phrases ?? []
    if (extra.length === 0) return out
    const seen = new Set(out.general.map((p) => p.trigger.toLowerCase()))
    const general = out.general.slice()
    for (const p of extra) {
      const key = p.trigger.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      general.push(p)
    }
    return { ...out, general }
  }, [enabledPacks, state?.customVocab])

  async function handleToggleVocabPack(id: string, enabled: boolean) {
    try {
      const updated = await window.scipaper.setVocabPackEnabled(id, enabled)
      setVocabPackSummaries(updated)
    } catch (error) {
      console.error('setVocabPackEnabled failed:', error)
    }
  }

  async function handleImportVocabPack(payload: {
    name: string
    description?: string
    words: string[] | Partial<Record<SciSection, string[]>>
  }): Promise<VocabPack> {
    const newPack = await window.scipaper.importVocabPack(payload)
    const [summaries, custom] = await Promise.all([
      window.scipaper.listVocabPacks(),
      window.scipaper.getCustomVocabPacks(),
    ])
    setVocabPackSummaries(summaries)
    setCustomVocabPacks(custom)
    return newPack
  }

  async function handleDeleteVocabPack(id: string) {
    const updated = await window.scipaper.deleteCustomVocabPack(id)
    setVocabPackSummaries(updated)
    const custom = await window.scipaper.getCustomVocabPacks()
    setCustomVocabPacks(custom)
  }

  async function handleRenameVocabPack(id: string, name: string) {
    await window.scipaper.renameCustomVocabPack(id, name)
    const custom = await window.scipaper.getCustomVocabPacks()
    setCustomVocabPacks(custom)
  }

  // Subscribe to LLM stream events
  useEffect(() => {
    const unsubscribe = window.scipaper.llmOnEvent((event) => {
      const e = event as unknown as { _channel?: string } & Record<string, unknown>

      if (e._channel === 'event') {
        const kind = e.kind as string
        const sessionId = e.sessionId as string
        if (sessionId !== aiSessionRef.current) return

        if (kind === 'textDelta') {
          const delta = (e.delta as string) || ''
          setAiMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.role === 'assistant' && last.pending) {
              const updated = [...prev]
              updated[updated.length - 1] = { ...last, text: last.text + delta }
              return updated
            }
            return [
              ...prev,
              {
                id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                role: 'assistant',
                text: delta,
                pending: true,
              },
            ]
          })
        } else if (kind === 'limit') {
          setAiMessages((prev) => [
            ...prev,
            { id: `sys_${Date.now()}`, role: 'system', text: (e.message as string) || '工具调用超过上限' },
          ])
        } else if (kind === 'done') {
          setAiBusy(false)
          setAiMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.role === 'assistant' && last.pending) {
              const updated = [...prev]
              updated[updated.length - 1] = { ...last, pending: false }
              return updated
            }
            return prev
          })
          aiSessionRef.current = null
        } else if (kind === 'error') {
          setAiBusy(false)
          setAiMessages((prev) => [
            ...prev,
            { id: `sys_${Date.now()}`, role: 'system', text: '错误: ' + ((e.message as string) || '未知错误') },
          ])
          aiSessionRef.current = null
        }
      }

      if (e._channel === 'toolEvent') {
        const sessionId = e.sessionId as string
        if (sessionId !== aiSessionRef.current) return
        const toolEventKind = e.kind as string
        const callId = e.callId as string

        if (toolEventKind === 'askApproval') {
          setApprovalRequest({
            callId,
            toolName: (e.toolName as string) || '',
            summary: (e.summary as string) || '',
            args: (() => {
              try { return JSON.parse((e.argsJson as string) || '{}') } catch { return {} }
            })(),
          })
          setAiMessages((prev) => [
            ...prev,
            {
              id: `tool_${callId}`,
              role: 'tool',
              toolName: (e.toolName as string) || '',
              status: 'pending',
              summary: (e.summary as string) || '',
              argsJson: e.argsJson as string,
            },
          ])
        } else if (toolEventKind === 'result') {
          setAiToolCallCount((c) => c + 1)
          setAiMessages((prev) =>
            prev.map((m) => {
              if (m.role === 'tool' && m.id === `tool_${callId}`) {
                return {
                  ...m,
                  status: (e.status as AssistantMessage extends { status: infer S } ? S : never) || 'success',
                  result: typeof e.result === 'string' ? (e.result as string) : JSON.stringify(e.result),
                }
              }
              return m
            }),
          )
        }
      }
    })
    return unsubscribe
  }, [])

  async function refreshProviders() {
    const data = await window.scipaper.llmListProviders()
    setProviders(data.providers)
    setActiveProviderId(data.activeId)
    setPresets(data.presets)
  }

  async function handleAddProvider(draft: Omit<LlmProvider, 'id' | 'hasApiKey'> & { apiKey: string }) {
    const data = await window.scipaper.llmAddProvider(draft)
    setProviders(data.providers)
    setActiveProviderId(data.activeId)
    setPresets(data.presets)
    return data
  }
  async function handleUpdateProvider(
    id: string,
    patch: Partial<Omit<LlmProvider, 'id' | 'hasApiKey'>> & { apiKey?: string },
  ) {
    await window.scipaper.llmUpdateProvider(id, patch)
    await refreshProviders()
  }
  async function handleDeleteProvider(id: string) {
    await window.scipaper.llmDeleteProvider(id)
    await refreshProviders()
  }
  async function handleSetActiveProvider(id: string) {
    await window.scipaper.llmSetActiveProvider(id)
    await refreshProviders()
  }
  async function handleTestProvider(id: string) {
    return window.scipaper.llmTestProvider(id)
  }

  async function handleOpenDataFolder() {
    try {
      await window.scipaper.openDataFolder()
      setNotice('已打开本地数据目录')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '打开数据目录失败')
      throw error
    }
  }

  async function handleExportFullBackup() {
    try {
      const result = await window.scipaper.exportFullBackup()
      if (result?.backupPath) setNotice('完整备份已导出')
      return result?.backupPath ?? null
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导出备份失败')
      throw error
    }
  }

  async function handleRestoreFullBackup() {
    try {
      const result = await window.scipaper.restoreFullBackup()
      if (!result) return null
      setState(result.state)
      setWritingStats(await window.scipaper.getWritingStats())
      setSelectedArticleId(result.state.articles[0]?.id ?? null)
      setSelectedThesisId(result.state.theses[0]?.id ?? null)
      setNotice('备份已恢复')
      return {
        restoredFiles: result.restoredFiles,
        preRestoreBackupPath: result.preRestoreBackupPath,
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '恢复备份失败')
      throw error
    }
  }

  async function refreshScenarios() {
    const list = await window.scipaper.listScenarios()
    setScenarios(list)
  }
  async function handleAddScenario(draft: Omit<WritingScenario, 'id' | 'builtin'>) {
    await window.scipaper.addScenario(draft)
    await refreshScenarios()
  }
  async function handleUpdateScenario(id: string, patch: Partial<Omit<WritingScenario, 'id' | 'builtin'>>) {
    await window.scipaper.updateScenario(id, patch)
    await refreshScenarios()
  }
  async function handleDeleteScenario(id: string) {
    await window.scipaper.deleteScenario(id)
    await refreshScenarios()
  }
  async function handleResetScenario(id: string) {
    await window.scipaper.resetScenarioToDefault(id)
    await refreshScenarios()
  }

  async function handleUpdateItalicGuide(next: ItalicGuide) {
    const saved = await window.scipaper.setItalicGuide(next)
    setItalicGuide(saved)
  }

  async function handleUpdateZoteroConfig(next: ZoteroConfig) {
    const saved = await window.scipaper.setZoteroConfig(next)
    setZoteroConfig(saved)
  }

  function openShareCard() {
    const ws = state?.writingStreak
    if (!ws) return
    const ctx = {
      netWords: ws.todayWords ?? 0,
      changedWords: ws.todayChangedWords ?? Math.abs(ws.todayWords ?? 0),
      focusMinutes: state?.pomodoroStats?.todayMinutes ?? 0,
      streak: ws.currentStreak ?? 0,
      goalMet: (ws.todayWords ?? 0) >= (ws.dailyGoal ?? 1000),
    }
    setShareJoke(pickJoke(ctx))
    setShareOpen(true)
  }
  function regenerateJoke() {
    const ws = state?.writingStreak
    if (!ws) return
    const ctx = {
      netWords: ws.todayWords ?? 0,
      changedWords: ws.todayChangedWords ?? Math.abs(ws.todayWords ?? 0),
      focusMinutes: state?.pomodoroStats?.todayMinutes ?? 0,
      streak: ws.currentStreak ?? 0,
      goalMet: (ws.todayWords ?? 0) >= (ws.dailyGoal ?? 1000),
    }
    setShareJoke(pickJoke(ctx))
  }

  async function handleAiSend(text: string) {
    if (!activeProviderId) {
      setAiMessages((prev) => [
        ...prev,
        { id: `sys_${Date.now()}`, role: 'system', text: '请先在 Settings 设置 active provider' },
      ])
      return
    }
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    aiSessionRef.current = sessionId
    setAiBusy(true)
    setAiToolCallCount(0)

    const userMsg: AssistantMessage = { id: `usr_${Date.now()}`, role: 'user', text }
    const history = aiMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: 'text' in m ? m.text : '' }))
    setAiMessages((prev) => [...prev, userMsg])

    // When the immersive editor is open, prefer its focus context — the
    // user is actively editing one block and AI suggestions should center
    // on that block, not the whole section excerpt.
    const currentSection = focusSection
      ? {
          type: focusSection.type,
          contentExcerpt: (focusBlock?.content ?? '').slice(0, 800),
          currentBlockId: focusBlock?.id ?? null,
        }
      : selectedArticle && isSectionTab(articleTab)
      ? {
          type: articleTab,
          contentExcerpt: (selectedArticle.sections.find((s) => s.type === articleTab)?.contentBlocks || [])
            .filter((b) => b.type === 'Text')
            .map((b) => b.content)
            .join('\n\n')
            .slice(0, 800),
        }
      : null

    const currentArticle = selectedArticle
      ? {
          id: selectedArticle.id,
          title: selectedArticle.title,
          targetJournal: selectedArticle.targetJournal,
          status: selectedArticle.status,
          researchContext: selectedArticle.researchContext,
        }
      : null

    try {
      const result = await window.scipaper.llmStartChat({
        sessionId,
        userMessage: text,
        history,
        currentArticle,
        currentSection,
        scenarioId: currentScenarioId,
      })

      if (!result.ok) {
        setAiBusy(false)
        aiSessionRef.current = null
        setAiMessages((prev) => [
          ...prev,
          { id: `sys_${Date.now()}`, role: 'system', text: '启动失败: ' + (result.error || '未知错误') },
        ])
      }
    } catch (error) {
      // 不 catch 会让 aiBusy 永久 true，AI 助手锁死直到重启。
      setAiBusy(false)
      aiSessionRef.current = null
      const message = error instanceof Error ? error.message : String(error)
      setAiMessages((prev) => [
        ...prev,
        { id: `sys_${Date.now()}`, role: 'system', text: '启动异常: ' + message },
      ])
    }
  }

  async function handleAiCancel() {
    const sessionId = aiSessionRef.current
    aiSessionRef.current = null
    setAiBusy(false)
    if (!sessionId) return
    try {
      await window.scipaper.llmCancelSession(sessionId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAiMessages((prev) => [
        ...prev,
        { id: `sys_${Date.now()}`, role: 'system', text: '取消失败: ' + message },
      ])
    }
  }

  async function handleApprove(callId: string, alwaysAllow: boolean) {
    const sessionId = aiSessionRef.current
    setApprovalRequest(null)
    if (!sessionId) return
    try {
      await window.scipaper.llmApprove(sessionId, callId, true, alwaysAllow)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAiMessages((prev) => [
        ...prev,
        { id: `sys_${Date.now()}`, role: 'system', text: '批准失败: ' + message },
      ])
    }
  }

  async function handleReject(callId: string) {
    const sessionId = aiSessionRef.current
    setApprovalRequest(null)
    if (!sessionId) return
    try {
      await window.scipaper.llmApprove(sessionId, callId, false, false)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAiMessages((prev) => [
        ...prev,
        { id: `sys_${Date.now()}`, role: 'system', text: '拒绝失败: ' + message },
      ])
    }
  }

  const selectedArticle = state?.articles.find((article) => article.id === selectedArticleId) ?? null

  useEffect(() => {
    if (!selectedArticle) {
      return
    }

    setMetaDraft({
      title: selectedArticle.title,
      targetJournal: selectedArticle.targetJournal,
      status: selectedArticle.status,
    })
  }, [selectedArticle?.id])

  const filteredArticles =
    state?.articles.filter((article) => {
      const keyword = deferredSearch.trim().toLowerCase()

      if (!keyword) {
        return true
      }

      const haystack = [
        article.title,
        article.targetJournal,
        article.researchContext.scientificQuestion,
        article.researchContext.observedPhenomenon,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    }) ?? []

  // theses 也按 sidebar 搜索框过滤；之前只过滤 articles → Library 视图下
  // 搜索学位论文时永远显示全部，与 articles 的行为不一致。
  const filteredTheses =
    state?.theses.filter((thesis) => {
      const keyword = deferredSearch.trim().toLowerCase()
      if (!keyword) return true
      const haystack = [thesis.title, thesis.titleEn, thesis.author, thesis.institution, thesis.department]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(keyword)
    }) ?? []

  async function mutate(action: () => Promise<AppState>, successMessage?: string) {
    try {
      setBusy(true)
      const nextState = await action()
      setState(nextState)
      setWritingStats(await window.scipaper.getWritingStats())

      if (!selectedArticleId && nextState.articles[0]) {
        setSelectedArticleId(nextState.articles[0].id)
      }

      if (selectedArticleId && !nextState.articles.find((item) => item.id === selectedArticleId)) {
        setSelectedArticleId(nextState.articles[0]?.id ?? null)
      }

      if (successMessage) {
        setNotice(successMessage)
      }
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateArticle(payload: CreateArticlePayload) {
    await mutate(async () => {
      const nextState = await window.scipaper.createArticle(payload)
      const newId = nextState.articles[0]?.id ?? null
      setSelectedArticleId(newId)
      setArticleTab('Introduction')
      if (newId) {
        setRoute('article')
      }
      setWizardOpen(false)
      return nextState
    }, '已创建新论文项目')
  }

  async function handleCreateThesis(payload: CreateThesisPayload) {
    await mutate(async () => {
      const nextState = await window.scipaper.createThesis(payload)
      const newId = nextState.theses[0]?.id ?? null
      setSelectedThesisId(newId)
      if (newId) {
        setRoute('thesis')
      }
      setThesisWizardOpen(false)
      return nextState
    }, '已创建新学位论文')
  }

  async function handleUpdateThesis(thesisId: string, patch: UpdateThesisPayload) {
    await mutate(() => window.scipaper.updateThesisMeta(thesisId, patch), '大论文信息已保存')
  }

  async function handleDeleteThesis(thesisId: string, title: string) {
    await mutate(async () => {
      const nextState = await window.scipaper.deleteThesis(thesisId)
      if (selectedThesisId === thesisId) {
        setSelectedThesisId(null)
        setRoute('library')
      }
      return nextState
    }, `已删除大论文「${title}」`)
  }

  async function handleLinkArticleToThesis(thesisId: string, articleId: string) {
    await mutate(() => window.scipaper.linkArticleToThesis(thesisId, articleId), '已关联小论文')
  }

  async function handleUnlinkArticleFromThesis(thesisId: string, articleId: string) {
    await mutate(() => window.scipaper.unlinkArticleFromThesis(thesisId, articleId), '已取消关联')
  }

  async function handleAddThesisTextBlock(thesisId: string, sectionId: string, content: string, description?: string) {
    await mutate(() => window.scipaper.addThesisTextBlock(thesisId, sectionId, content, description), '大论文章节正文已添加')
  }

  async function handleUpdateThesisTextBlock(thesisId: string, blockId: string, content: string, description?: string) {
    await mutate(() => window.scipaper.updateThesisTextBlock(thesisId, blockId, content, description), '大论文章节正文已保存')
  }

  async function handleDeleteThesisBlock(thesisId: string, blockId: string) {
    await mutate(() => window.scipaper.deleteThesisBlock(thesisId, blockId), '大论文章节文本块已删除')
  }

  async function handleExportThesisMarkdown(thesisId: string) {
    try {
      const exportPath = await window.scipaper.exportThesisMarkdown(thesisId)
      setLastExport({ kind: 'thesis', id: thesisId, path: exportPath })
      setNotice(`大论文 Markdown 已导出：${exportPath}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '大论文导出失败')
    }
  }

  async function saveMeta() {
    if (!selectedArticle) {
      return
    }

    await mutate(
      () => window.scipaper.updateArticleMeta(selectedArticle.id, metaDraft),
      '论文基础信息已保存',
    )
  }

  async function handleAddMood(mood: MoodType, note?: string) {
    await mutate(async () => {
      const nextState = await window.scipaper.addMoodEntry(mood, note)
      return nextState
    }, '心情已记录')
  }

  async function handleAddPomodoro(duration: number) {
    await mutate(async () => {
      const nextState = await window.scipaper.addPomodoroSession(duration)
      return nextState
    }, '番茄钟已完成')
  }

  async function handleAddCitation(citation: BibTeXEntry) {
    if (!selectedArticle) return
    await mutate(async () => {
      const nextState = await window.scipaper.addCitation(selectedArticle.id, citation)
      return nextState
    }, '参考文献已添加')
  }

  async function handleUpdateCitation(citationId: string, patch: Partial<import('./types').Citation>) {
    if (!selectedArticle) return
    await mutate(() => window.scipaper.updateCitation(selectedArticle.id, citationId, patch), '参考文献已更新')
  }

  async function handleDeleteCitation(citationId: string) {
    if (!selectedArticle) return
    await mutate(() => window.scipaper.deleteCitation(selectedArticle.id, citationId), '参考文献已删除')
  }

  async function handleThemeChange(newTheme: ThemeType) {
    await mutate(async () => {
      const nextState = await window.scipaper.setTheme(newTheme)
      setTheme(newTheme)
      document.documentElement.setAttribute('data-theme', newTheme)
      return nextState
    }, '主题已切换')
  }

  async function handleAddTag(tagName: string, tagColor: TagColor) {
    if (!selectedArticle) return
    await mutate(async () => {
      const nextState = await window.scipaper.addTag(selectedArticle.id, tagName, tagColor)
      return nextState
    }, '标签已添加')
  }

  async function handleRemoveTag(tagId: string) {
    if (!selectedArticle) return
    await mutate(async () => {
      const nextState = await window.scipaper.removeTag(selectedArticle.id, tagId)
      return nextState
    }, '标签已删除')
  }

  async function handleExportLatex() {
    if (!selectedArticle) return
    try {
      const exportPath = await window.scipaper.exportArticleLatex(selectedArticle.id)
      setLastExport({ kind: 'article', id: selectedArticle.id, path: exportPath })
      setNotice(`LaTeX 导出成功：${exportPath}`)
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'LaTeX 导出失败')
    }
  }

  async function handleExportMarkdown() {
    if (!selectedArticle) return
    try {
      const exportPath = await window.scipaper.exportMarkdown(selectedArticle.id)
      setLastExport({ kind: 'article', id: selectedArticle.id, path: exportPath })
      setNotice(`分享 Markdown 导出成功：${exportPath}`)
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : '分享 Markdown 导出失败')
    }
  }

  async function handleExportReimportableMarkdown() {
    if (!selectedArticle) return
    try {
      const exportPath = await window.scipaper.exportReimportableMarkdown(selectedArticle.id)
      setLastExport({ kind: 'article', id: selectedArticle.id, path: exportPath })
      setNotice(`回导 Markdown 已导出：${exportPath}`)
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : '回导 Markdown 导出失败')
    }
  }

  async function handleExportDocx() {
    if (!selectedArticle || docxBusy) return
    try {
      setDocxBusy(true)
      const exportPath = await window.scipaper.exportArticleDocx(
        selectedArticle.id,
        docxTemplate,
        docxApplyItalic,
      )
      setLastExport({ kind: 'article', id: selectedArticle.id, path: exportPath })
      setNotice(`docx 导出成功：${exportPath}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setNotice(`docx 导出失败：${message}`)
    } finally {
      setDocxBusy(false)
    }
  }

  async function handleExportHTML() {
    if (!selectedArticle) return
    try {
      const exportPath = await window.scipaper.exportToHTML(selectedArticle.id)
      setLastExport({ kind: 'article', id: selectedArticle.id, path: exportPath })
      setNotice(`HTML 导出成功：${exportPath}`)
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'HTML 导出失败')
    }
  }

  async function handleExportJSON() {
    if (!selectedArticle) return
    try {
      const exportPath = await window.scipaper.exportToJSON(selectedArticle.id)
      setLastExport({ kind: 'article', id: selectedArticle.id, path: exportPath })
      setNotice(`JSON 导出成功：${exportPath}`)
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'JSON 导出失败')
    }
  }

  async function handleCreateSharePackage() {
    if (!selectedArticle) return
    try {
      const exportPath = await window.scipaper.createSharePackage(selectedArticle.id)
      setLastExport({ kind: 'article', id: selectedArticle.id, path: exportPath })
      setNotice(`分享包创建成功：${exportPath}`)
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : '分享包创建失败')
    }
  }

  const activeSection =
    selectedArticle && isSectionTab(articleTab)
      ? selectedArticle.sections.find((section) => section.type === articleTab) ?? null
      : null

  // Inline focus mode: focusSection = the active Section tab; focusBlock =
  // its (single) text block. Lazy-created on first save.
  const focusSection = activeSection
  const focusBlock = focusSection
    ? focusSection.contentBlocks.find((b) => b.type === 'Text') ?? null
    : null

  // Silent save for focus mode — bypass `mutate` to avoid the busy spinner
  // interrupting the typing rhythm. Single-block policy: lazily create the
  // section's text block on first non-empty save; otherwise update it in
  // place. focusBlock is derived synchronously from state, so React handles
  // the pivot automatically once the new block lands.
  async function focusModeSave(content: string, description: string) {
    if (!selectedArticle || !focusSection) return
    if (focusBlock) {
      const next = await window.scipaper.updateTextBlock(
        selectedArticle.id,
        focusBlock.id,
        content,
        description,
      )
      setState(next)
      return
    }
    if (content.trim()) {
      const next = await window.scipaper.addTextBlock(
        selectedArticle.id,
        focusSection.type,
        content,
        description,
      )
      setState(next)
    }
  }

  async function focusModeAddAnnotation(payload: {
    anchorText: string
    comment: string
    author: AnnotationAuthor
  }) {
    if (!selectedArticle || !focusBlock) return
    const next = await window.scipaper.addAnnotation(selectedArticle.id, focusBlock.id, payload)
    setState(next)
  }

  async function focusModeUpdateAnnotation(
    id: string,
    patch: { comment?: string; status?: AnnotationStatus },
  ) {
    if (!selectedArticle) return
    const next = await window.scipaper.updateAnnotation(selectedArticle.id, id, patch)
    setState(next)
  }

  async function focusModeDeleteAnnotation(id: string) {
    if (!selectedArticle) return
    const next = await window.scipaper.deleteAnnotation(selectedArticle.id, id)
    setState(next)
  }

  const handleOpenFocusAi = useCallback(() => {
    setAiOpen(true)
  }, [])

  const handleExitFocusMode = useCallback(() => {
    setFocusViewMode('preview')
  }, [])

  const handleRecordFocusVersion = useCallback(
    async (changeDescription: string) => {
      if (!selectedArticleId || !focusBlock) return
      const next = await window.scipaper.recordBlockVersion(
        selectedArticleId,
        focusBlock.id,
        changeDescription,
      )
      setState(next)
    },
    [selectedArticleId, focusBlock],
  )

  function openArticle(id: string) {
    setSelectedArticleId(id)
    setSelectedThesisId(null)
    setArticleTab('Introduction')
    setRoute('article')
  }

  function openThesis(id: string) {
    setSelectedThesisId(id)
    setRoute('thesis')
  }

  async function handleAddProgressEntry(payload: {
    articleId: string
    kind: ProgressEntryKind
    title: string
    detail?: string
    minutesSpent?: number
  }) {
    const newState = await window.scipaper.addProgressEntry(payload)
    setState(newState)
  }

  async function handleDeleteProgressEntry(entryId: string) {
    const newState = await window.scipaper.deleteProgressEntry(entryId)
    setState(newState)
  }

  async function handleUpdateProgressEntry(
    entryId: string,
    patch: { articleId?: string; kind?: ProgressEntryKind; title?: string; detail?: string; minutesSpent?: number },
  ) {
    const newState = await window.scipaper.updateProgressEntry(entryId, patch)
    setState(newState)
  }

  async function handleSetDailyPlan(planText: string) {
    const today = localIsoDate()
    const newState = await window.scipaper.setDailyPlan(today, planText)
    setState(newState)
  }

  async function handleEndDailySession(summaryText: string) {
    const today = localIsoDate()
    const newState = await window.scipaper.endDailySession(today, summaryText)
    setState(newState)
  }

  const today = localIsoDate()
  const selectedThesis = state?.theses.find((thesis) => thesis.id === selectedThesisId) ?? null
  const todayWords = state?.writingStreak.todayWords ?? 0
  const todayEntries = (state?.progressEntries ?? []).filter((entry) => entry.date === today)
  const kindOrder: ProgressEntryKind[] = ['read', 'experiment', 'writing', 'analysis', 'idea', 'cite', 'focus', 'mood']
  const entriesByKind = state
    ? kindOrder
        .map((kind) => {
          if (kind === 'writing') {
            return { kind, count: todayWords, items: [] as { title: string; articleTitle?: string }[] }
          }

          const group = todayEntries.filter((entry) => entry.kind === kind)
          if (kind === 'focus') {
            const totalMinutes = group.reduce((sum, entry) => sum + Math.max(0, entry.minutesSpent ?? 25), 0)
            return {
              kind,
              count: group.length,
              totalMinutes,
              items: [] as { title: string; articleTitle?: string }[],
            }
          }

          const entriesForItems = kind === 'mood'
            ? [...group].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3)
            : group.slice(0, 3)

          return {
            kind,
            count: group.length,
            items: entriesForItems.map((entry) => {
              const articleTitle = state.articles.find((article) => article.id === entry.articleId)?.title
              return articleTitle ? { title: entry.title, articleTitle } : { title: entry.title }
            }),
          }
        })
        .filter((group) => group.count > 0)
    : []
  const aiContextHint = (() => {
    if (route === 'article' && selectedArticle) {
      return `当前文章: ${selectedArticle.title}${isSectionTab(articleTab) ? ' · ' + SECTION_LABELS[articleTab] : ''}`
    }
    if (route === 'thesis' && selectedThesis) return `当前学位论文: ${selectedThesis.title}`
    if (route === 'daily') return '当前页面: Daily Log · 可记录未归属科研进展'
    if (route === 'library') return '当前页面: Library · 未限定到单篇文章'
    if (route === 'settings') return '当前页面: Settings · 配置与工具管理'
    return selectedArticle ? `已选择文章: ${selectedArticle.title}` : undefined
  })()

  return (
    <>
      {splashVisible ? <SplashScreen onDone={() => setSplashVisible(false)} /> : null}
      <ArticleWizard busy={busy} onClose={() => setWizardOpen(false)} onSubmit={handleCreateArticle} open={wizardOpen} />
      <ThesisWizard busy={busy} onClose={() => setThesisWizardOpen(false)} onSubmit={handleCreateThesis} open={thesisWizardOpen} />

      <AIAssistantPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        activeProvider={
          activeProviderId
            ? (() => {
                const p = providers.find((x) => x.id === activeProviderId)
                return p
                  ? { id: p.id, name: p.name, model: p.model, supportsToolUse: p.supportsToolUse }
                  : null
              })()
            : null
        }
        providers={providers.map((p) => ({ id: p.id, name: p.name, model: p.model, supportsToolUse: p.supportsToolUse }))}
        onSwitchProvider={handleSetActiveProvider}
        messages={aiMessages}
        busy={aiBusy}
        toolCallCount={aiToolCallCount}
        onSend={handleAiSend}
        onCancel={handleAiCancel}
        contextHint={aiContextHint}
        onOpenSettings={() => {
          setAiOpen(false)
          setPendingSettingsFocus('ai')
          setRoute('settings')
        }}
        scenarios={scenarios.filter((s) => s.enabled)}
        currentScenarioId={currentScenarioId}
        onChangeScenario={setCurrentScenarioId}
        articleTitle={selectedArticle?.title}
        onSwitchArticle={
          selectedArticle
            ? () => {
                setAiOpen(false)
                setRoute('library')
              }
            : undefined
        }
      />

      <ImportAssistantModal
        open={importAssistantOpen}
        article={selectedArticle ?? null}
        busy={busy}
        defaultMode={importAssistantMode}
        onClose={() => setImportAssistantOpen(false)}
        onApplied={async (nextState, message) => {
          setState(nextState)
          setWritingStats(await window.scipaper.getWritingStats())
          if (message.includes('审稿')) setArticleTab('Review')
          setRoute('article')
          setNotice(message)
        }}
        onError={(message) => setNotice(message)}
      />

      <ApprovalDialog
        request={approvalRequest}
        onApprove={(callId, alwaysAllow) => handleApprove(callId, alwaysAllow)}
        onReject={(callId) => handleReject(callId)}
      />

      {focusViewMode === 'edit' && selectedArticle && focusSection ? (
        <FocusModeEditor
          // 强制按 block.id / section.id 切换时 remount。否则 dirty 守卫会
          // 跳过覆盖，旧 block 的 ProseMirror 状态会被错位写到新 block 上。
          key={`${focusSection.id}:${focusBlock?.id ?? 'empty'}`}
          article={selectedArticle}
          section={focusSection}
          block={focusBlock}
          annotations={focusBlock?.annotations ?? []}
          onSave={focusModeSave}
          onAddAnnotation={focusModeAddAnnotation}
          onUpdateAnnotation={focusModeUpdateAnnotation}
          onDeleteAnnotation={focusModeDeleteAnnotation}
          onOpenAi={handleOpenFocusAi}
          onExit={handleExitFocusMode}
          onRecordVersion={handleRecordFocusVersion}
          mergedWords={mergedVocabWords}
          mergedPhrases={mergedVocabPhrases}
          todayWords={state?.writingStreak?.todayWords ?? undefined}
          dailyGoal={state?.writingStreak?.dailyGoal ?? undefined}
          pomodoroToday={state?.pomodoroStats?.todaySessions ?? 0}
          onAddPomodoro={handleAddPomodoro}
        />
      ) : null}

      {state ? (
        <ShareCard
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          theme={theme}
          data={{
            date: today,
            todayWords: state.writingStreak.todayWords ?? 0,
            addedWords: state.writingStreak.todayAddedWords ?? Math.max(0, state.writingStreak.todayWords ?? 0),
            removedWords: state.writingStreak.todayRemovedWords ?? 0,
            changedWords: state.writingStreak.todayChangedWords ?? Math.abs(state.writingStreak.todayWords ?? 0),
            byAI: state.writingStreak.todayByAI ?? 0,
            byManual: state.writingStreak.todayByManual ?? Math.abs(state.writingStreak.todayWords ?? 0),
            focusMinutes: state.pomodoroStats?.todayMinutes ?? 0,
            streak: state.writingStreak.currentStreak ?? 0,
            dailyGoal: state.writingStreak.dailyGoal ?? 1000,
            analogy: pickAnalogy(Math.max(0, state.writingStreak.todayWords ?? 0)),
            joke: shareJoke,
            entriesByKind,
          }}
          onRegenerateJoke={regenerateJoke}
        />
      ) : null}

      <div className={`app-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        <AppSidebar
          route={route}
          onNavigate={(next) => {
            if (next === 'article' && !selectedArticle) {
              setRoute('library')
              return
            }
            setRoute(next)
          }}
          onNewArticle={() => setWizardOpen(true)}
          onNewThesis={() => setThesisWizardOpen(true)}
          onOpenAi={() => setAiOpen(true)}
          searchValue={search}
          onSearchChange={setSearch}
          todayWords={state?.writingStreak.todayWords ?? 0}
          dailyGoal={state?.writingStreak.dailyGoal ?? 1000}
          hasOpenArticle={!!selectedArticle}
          openArticleTitle={selectedArticle?.title ?? null}
          userDisplayName={state?.userProfile?.displayName ?? ''}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />

        <main className="route-main">
          {notice ? <div className="notice-banner">{notice}</div> : null}

          {!state ? (
            <section className="empty-state">
              <p className="eyebrow">SciPaper Todo</p>
              <h2>{greeting}</h2>
              <p>载入中…</p>
            </section>
          ) : null}

          {state && route === 'home' ? (
            <HomeView
              state={state}
              onResume={openArticle}
              onNavigate={setRoute}
            />
          ) : null}

          {state && route === 'library' ? (
            <LibraryView
              articles={filteredArticles}
              theses={filteredTheses}
              onOpenArticle={openArticle}
              onOpenThesis={openThesis}
              onNewArticle={() => setWizardOpen(true)}
              onNewThesis={() => setThesisWizardOpen(true)}
              onDeleteThesis={handleDeleteThesis}
              onDeleteArticle={async (id, title) => {
                try {
                  const next = await window.scipaper.deleteArticle(id)
                  setState(next)
                  if (selectedArticleId === id) setSelectedArticleId(null)
                  setNotice(`已删除「${title}」`)
                } catch (error) {
                  setNotice(error instanceof Error ? error.message : '删除失败')
                }
              }}
            />
          ) : null}

          {state && route === 'thesis' && selectedThesis ? (
            <ThesisDetailView
              thesis={selectedThesis}
              articles={state.articles}
              onBack={() => setRoute('library')}
              onOpenArticle={openArticle}
              onUpdate={handleUpdateThesis}
              onDelete={handleDeleteThesis}
              onLinkArticle={handleLinkArticleToThesis}
              onUnlinkArticle={handleUnlinkArticleFromThesis}
              onAddTextBlock={handleAddThesisTextBlock}
              onUpdateTextBlock={handleUpdateThesisTextBlock}
              onDeleteBlock={handleDeleteThesisBlock}
              onExportMarkdown={handleExportThesisMarkdown}
              lastExportPath={lastExport?.kind === 'thesis' && lastExport.id === selectedThesis.id ? lastExport.path : ''}
            />
          ) : null}

          {state && route === 'daily' ? (
            <DailyLogView
              state={state}
              onAddProgressEntry={handleAddProgressEntry}
              onDeleteProgressEntry={handleDeleteProgressEntry}
              onUpdateProgressEntry={handleUpdateProgressEntry}
              onSetDailyPlan={handleSetDailyPlan}
              onEndDailySession={handleEndDailySession}
              onAddPomodoro={handleAddPomodoro}
              onAddMood={handleAddMood}
              onUpdateGoal={async (goal) => {
                await mutate(() => window.scipaper.updateDailyGoal(goal))
              }}
              onShareToday={openShareCard}
            />
          ) : null}

          {state && route === 'settings' ? (
            <SettingsView
              state={state}
              theme={theme}
              onThemeChange={handleThemeChange}
              fontScale={fontScale}
              onFontScaleChange={setFontScale}
              mcpInfo={mcpInfo}
              providers={providers}
              activeProviderId={activeProviderId}
              presets={presets}
              onAddProvider={handleAddProvider}
              onUpdateProvider={handleUpdateProvider}
              onDeleteProvider={handleDeleteProvider}
              onSetActiveProvider={handleSetActiveProvider}
              onTestProvider={handleTestProvider}
              scenarios={scenarios}
              onAddScenario={handleAddScenario}
              onUpdateScenario={handleUpdateScenario}
              onDeleteScenario={handleDeleteScenario}
              onResetScenario={handleResetScenario}
              italicGuide={italicGuide}
              onUpdateItalicGuide={handleUpdateItalicGuide}
              zoteroConfig={zoteroConfig}
              onUpdateZoteroConfig={handleUpdateZoteroConfig}
              writingStats={writingStats}
              autoApproveTools={autoApproveTools}
              onSetAutoApproveTools={async (value) => {
                const saved = await window.scipaper.setAutoApproveTools(value)
                setAutoApproveToolsState(Boolean(saved))
              }}
              userDisplayName={state.userProfile?.displayName ?? ''}
              onUpdateUserDisplayName={async (next) => {
                const after = await window.scipaper.setUserProfile({ displayName: next })
                setState(after)
              }}
              vocabPackSummaries={vocabPackSummaries}
              customVocabPacks={customVocabPacks}
              onToggleVocabPack={handleToggleVocabPack}
              onImportVocabPack={handleImportVocabPack}
              onDeleteVocabPack={handleDeleteVocabPack}
              onRenameVocabPack={handleRenameVocabPack}
              initialFocus={pendingSettingsFocus}
              onFocusConsumed={() => setPendingSettingsFocus(null)}
              onOpenDataFolder={handleOpenDataFolder}
              onExportFullBackup={handleExportFullBackup}
              onRestoreFullBackup={handleRestoreFullBackup}
            />
          ) : null}

          {state && route === 'article' && !selectedArticle ? (
            <section className="empty-state">
              <p className="eyebrow">{greeting}</p>
              <h2>还没有打开的稿件</h2>
              <p>在左侧选 Library 找一篇,或用 Create 区新建。</p>
            </section>
          ) : null}

          {state && route === 'article' && selectedArticle ? (
            <div className="workspace article-view">
              <header className={`workspace-top dash-head${metaExpanded ? '' : ' workspace-top--collapsed'}`}>
                <div className="dash-head-top">
                  <p className="eyebrow">manuscript dashboard</p>
                  <span className="dash-status">
                    <span className="status-dot" aria-hidden />
                    {ARTICLE_STATUS_LABEL_ZH[selectedArticle.status]}
                    {selectedArticle.reviewRounds && selectedArticle.reviewRounds.length > 0 ? (
                      <> · 第 {selectedArticle.reviewRounds.length} 轮</>
                    ) : null}
                    {selectedArticle.updatedAt ? (
                      <> · 上次保存 {relativeTime(selectedArticle.updatedAt)}</>
                    ) : null}
                  </span>
                </div>
                <div className="meta-heading">
                  <h2 className="dash-title">{selectedArticle.title}</h2>
                  <p className="dash-journal">
                    {selectedArticle.targetJournal ? (
                      <span className="chip outline">{selectedArticle.targetJournal}</span>
                    ) : null}
                    <span className="chip neutral">
                      Article · {ARTICLE_STATUS_LABEL_ZH[selectedArticle.status]}
                    </span>
                  </p>
                </div>
                <div className="meta-toggle-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setMetaExpanded((v) => !v)}
                    title={metaExpanded ? '收起基础信息' : '修改标题/期刊/状态'}
                  >
                    {metaExpanded ? '收起基础信息' : '修改标题/期刊/状态'}
                  </button>
                  {isSectionTab(articleTab) ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setRightRailOpen((v) => !v)}
                      title={rightRailOpen ? '收起右侧侧栏' : '展开右侧侧栏'}
                    >
                      {rightRailOpen ? '收起侧栏 →' : '← 侧栏'}
                    </button>
                  ) : null}
                </div>

                <div className="meta-grid">
                  <label className="field compact">
                    <span>文章标题</span>
                    <input value={metaDraft.title} onChange={(event) => setMetaDraft({ ...metaDraft, title: event.target.value })} />
                  </label>
                  <label className="field compact">
                    <span>目标期刊</span>
                    <input
                      value={metaDraft.targetJournal}
                      onChange={(event) => setMetaDraft({ ...metaDraft, targetJournal: event.target.value })}
                    />
                  </label>
                  <label className="field compact">
                    <span>当前状态</span>
                    <select
                      value={metaDraft.status}
                      onChange={(event) => setMetaDraft({ ...metaDraft, status: event.target.value as ArticleStatus })}
                    >
                      {(['Drafting', 'Submitted', 'UnderReview', 'Revision', 'Resubmitted', 'Accepted', 'Rejected', 'Published'] as const).map(
                        (status) => (
                          <option key={status} value={status}>
                            {ARTICLE_STATUS_LABEL_ZH[status]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                {/* Design pack §① 9-button cluster split into 3 groups:
                    主行动 (continue/import) · 导出 (6 formats + docx settings) · 元信息 (save). */}
                <div className="dash-toolbar">
                  <div className="toolbar-row primary-row">
                    {activeSection ? (
                      <button
                        className="btn primary lg"
                        type="button"
                        onClick={() => setFocusViewMode('edit')}
                        title="进入沉浸式写作"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        继续写 · {SECTION_LABELS[activeSection.type]}
                      </button>
                    ) : null}

                    <span className="toolbar-divider" aria-hidden />

                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setImportAssistantMode('manuscript')
                        setImportAssistantOpen(true)
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      导入正文/审稿
                    </button>

                    <div className="export-group" role="group" aria-label="导出">
                      <span className="export-label">导出</span>
                      <div className="export-buttons">
                        <button
                          className="btn sm subtle"
                          onClick={handleExportMarkdown}
                          type="button"
                          title="分享 Markdown"
                        >
                          分享 MD
                        </button>
                        <button
                          className="btn sm subtle"
                          onClick={handleExportReimportableMarkdown}
                          type="button"
                          title="回导 Markdown"
                        >
                          回导 MD
                        </button>
                        <button
                          className="btn sm subtle"
                          disabled={docxBusy}
                          onClick={handleExportDocx}
                          type="button"
                          title="DOCX"
                        >
                          {docxBusy ? 'DOCX…' : 'DOCX'}
                        </button>
                        <button
                          className="btn sm subtle"
                          onClick={handleExportLatex}
                          type="button"
                          title="LaTeX"
                        >
                          LaTeX
                        </button>
                        <button className="btn sm subtle" onClick={handleExportHTML} type="button">
                          HTML
                        </button>
                        <button className="btn sm subtle" onClick={handleExportJSON} type="button">
                          JSON
                        </button>
                        <button className="btn sm subtle" onClick={handleCreateSharePackage} type="button">
                          分享包
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="toolbar-row meta-row">
                    <label className="select-inline">
                      <span className="meta-label">模板</span>
                      <select
                        className="select sm"
                        value={docxTemplate}
                        onChange={(event) => setDocxTemplate(event.target.value)}
                        title="docx 模板"
                      >
                        <option value="academic-en">通用学术 (英文)</option>
                        <option value="thesis-zh">中文学位论文</option>
                        <option value="nature">Nature 风格</option>
                      </select>
                    </label>
                    <label
                      className="checkbox-inline"
                      title="套斜体规范"
                    >
                      <input
                        type="checkbox"
                        checked={docxApplyItalic}
                        onChange={(event) => setDocxApplyItalic(event.target.checked)}
                      />
                      <span>套斜体规范</span>
                    </label>
                    <span className="grow" />
                    <button className="btn primary sm" disabled={busy} onClick={saveMeta} type="button">
                      保存信息
                    </button>
                  </div>
                </div>
                {lastExport?.kind === 'article' && lastExport.id === selectedArticle.id ? (
                  <div className="notice-banner" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', justifyContent: 'space-between', marginTop: 'var(--sp-3)' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      最近导出：{lastExport.path}
                    </span>
                    <button className="ghost-button" type="button" onClick={() => window.scipaper.copyText(lastExport.path)}>
                      复制路径
                    </button>
                  </div>
                ) : null}
              </header>

              <div
                className={`workspace-grid${sectionNavCollapsed ? ' is-nav-collapsed' : ''}${
                  rightRailOpen && isSectionTab(articleTab) ? ' is-rail-open' : ''
                }`}
              >
                <nav className={`section-nav${sectionNavCollapsed ? ' is-collapsed' : ''}`}>
                  <button
                    type="button"
                    className="section-nav-toggle"
                    onClick={() => setSectionNavCollapsed((v) => !v)}
                    title={sectionNavCollapsed ? '展开章节导航' : '收起章节导航'}
                    aria-label={sectionNavCollapsed ? '展开章节导航' : '收起章节导航'}
                  >
                    {sectionNavCollapsed ? '»' : '«'}
                  </button>

                  <div className="nav-group nav-group--imrad">
                    {selectedArticle.sections.map((section) => (
                      <button
                        key={section.id}
                        className={`nav-chip nav-chip--imrad ${articleTab === section.type ? 'active' : ''}`}
                        onClick={() => setArticleTab(section.type)}
                        type="button"
                        title={SECTION_LABELS[section.type]}
                      >
                        <span className="imrad-cn" aria-hidden>{SECTION_ABBREV_CN[section.type]}</span>
                        <span className="imrad-en">{SECTION_ABBREV_EN[section.type]}</span>
                        <em className="nav-chip-count">{section.contentBlocks.length}</em>
                        {/* Legacy fallback used by .is-collapsed icon-only mode. */}
                        <span className="nav-chip-label">{SECTION_LABELS[section.type]}</span>
                        <span className="nav-chip-glyph" aria-hidden>{SECTION_ABBREV_CN[section.type]}</span>
                      </button>
                    ))}
                  </div>

                  <div className="nav-divider" />

                  {ARTICLE_TOOL_TABS.map(({ tab, label }) => (
                    <button
                      key={tab}
                      className={`nav-chip utility ${articleTab === tab ? 'active' : ''}`}
                      onClick={() => setArticleTab(tab)}
                      type="button"
                      title={label}
                    >
                      <span className="nav-chip-label">{label}</span>
                      <span className="nav-chip-glyph" aria-hidden>{label.slice(0, 1)}</span>
                    </button>
                  ))}
                </nav>

                <section className="content-stage">
                  {activeSection && focusSection ? (
                    <SectionEditor
                      article={selectedArticle}
                      section={focusSection}
                      onEnterEdit={() => setFocusViewMode('edit')}
                      onAddImage={() =>
                        mutate(
                          () => window.scipaper.importAssetBlock(selectedArticle.id, focusSection.type, 'image'),
                          '已添加图片附件',
                        )
                      }
                      onAddFile={() =>
                        mutate(
                          () => window.scipaper.importAssetBlock(selectedArticle.id, focusSection.type, 'file'),
                          '已导入并备份文件',
                        )
                      }
                      onDeleteBlock={(blockId) =>
                        mutate(
                          () => window.scipaper.deleteBlock(selectedArticle.id, blockId),
                          '内容块已删除',
                        )
                      }
                      onOpenAsset={async (blockId) => {
                        await window.scipaper.openBlockAsset(selectedArticle.id, blockId)
                      }}
                      onAddFinding={(title) =>
                        mutate(
                          () => window.scipaper.addFinding(selectedArticle.id, focusSection.type, { title }),
                          '已新增 finding',
                        )
                      }
                      onUpdateFinding={(findingId, patch) =>
                        mutate(
                          () => window.scipaper.updateFinding(selectedArticle.id, findingId, patch),
                          'finding 已更新',
                        )
                      }
                      onDeleteFinding={(findingId) =>
                        mutate(
                          () => window.scipaper.deleteFinding(selectedArticle.id, findingId),
                          'finding 已删除',
                        )
                      }
                    />
                  ) : null}

                  {articleTab === 'ResearchContext' ? (
                    <ResearchContextPanel
                      article={selectedArticle}
                      onSave={(researchContext) =>
                        mutate(
                          () => window.scipaper.updateResearchContext(selectedArticle.id, researchContext),
                          '研究上下文已保存',
                        )
                      }
                    />
                  ) : null}

                  {articleTab === 'Review' ? (
                    <ReviewPanel
                      article={selectedArticle}
                      onUpdateRound={(roundId, patch) =>
                        mutate(
                          () => window.scipaper.updateReviewRound(selectedArticle.id, roundId, patch),
                          '审稿轮次已更新',
                        )
                      }
                      onAddComment={(roundId, payload) =>
                        mutate(() => window.scipaper.addReviewComment(selectedArticle.id, roundId, payload), '审稿意见已保存')
                      }
                      onAddRevision={(roundId, commentId, payload) =>
                        mutate(
                          () => window.scipaper.addRevision(selectedArticle.id, roundId, commentId, payload),
                          '修改记录已保存',
                        )
                      }
                      onUpdateRevision={(roundId, commentId, revisionId, patch) =>
                        mutate(
                          () => window.scipaper.updateRevision(selectedArticle.id, roundId, commentId, revisionId, patch),
                          '修回记录已更新',
                        )
                      }
                      onDeleteRevision={(roundId, commentId, revisionId) =>
                        mutate(
                          () => window.scipaper.deleteRevision(selectedArticle.id, roundId, commentId, revisionId),
                          '修回记录已删除',
                        )
                      }
                      onAddRound={(payload) =>
                        mutate(() => window.scipaper.addReviewRound(selectedArticle.id, payload), '投稿轮次已创建')
                      }
                      onUpdateStatus={(roundId, commentId, status) =>
                        mutate(
                          () => window.scipaper.updateReviewCommentStatus(selectedArticle.id, roundId, commentId, status),
                          '审稿状态已更新',
                        )
                      }
                      onUpdateComment={(roundId, commentId, patch) =>
                        mutate(
                          () => window.scipaper.updateReviewComment(selectedArticle.id, roundId, commentId, patch),
                          '审稿意见已更新',
                        )
                      }
                      onDeleteComment={(roundId, commentId) =>
                        mutate(
                          () => window.scipaper.deleteReviewComment(selectedArticle.id, roundId, commentId),
                          '审稿意见已删除',
                        )
                      }
                      onDeleteRound={(roundId) =>
                        mutate(
                          () => window.scipaper.deleteReviewRound(selectedArticle.id, roundId),
                          '审稿轮次已删除',
                        )
                      }
                      onOpenImport={() => {
                        setImportAssistantMode('review')
                        setImportAssistantOpen(true)
                      }}
                    />
                  ) : null}

                  {articleTab === 'Outline' ? (
                    <OutlineView
                      article={selectedArticle}
                      progressEntries={state.progressEntries}
                      onJumpSection={(type) => setArticleTab(type as SectionType)}
                    />
                  ) : null}

                  {articleTab === 'Citations' ? (
                    <CitationManager
                      article={selectedArticle}
                      onAddCitation={handleAddCitation}
                      onUpdateCitation={handleUpdateCitation}
                      onDeleteCitation={handleDeleteCitation}
                    />
                  ) : null}

                  {articleTab === 'Tags' ? (
                    <TagManager
                      tags={selectedArticle.tags || []}
                      onAddTag={handleAddTag}
                      onRemoveTag={handleRemoveTag}
                    />
                  ) : null}
                </section>

                {/* Right rail — only on Section tabs (Citations/Outline/Tags/Reviews
                    keep the 2-column layout because they own the full content stage). */}
                {isSectionTab(articleTab) && rightRailOpen ? (
                  <ArticleRightRail
                    article={selectedArticle}
                    section={focusSection}
                    focusBlock={focusBlock}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </>
  )
}

export default App

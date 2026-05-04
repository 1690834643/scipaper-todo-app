import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
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
import { AIAssistantPanel, type AssistantMessage } from './components/AIAssistantPanel'
import { ApprovalDialog } from './components/ApprovalDialog'
import { SplashScreen } from './components/SplashScreen'
import { ShareCard } from './components/ShareCard'
import { pickJoke, pickAnalogy } from './utils/jokesAndAnalogies'
import type { AppState, ArticleStatus, CreateArticlePayload, CreateThesisPayload, LlmPreset, LlmProvider, McpInfo, MoodType, ProgressEntryKind, SectionType, TagColor, ThemeType, WritingStats as WritingStatsType, ApprovalRequest, WritingScenario, ItalicGuide, ZoteroConfig, VocabPack, VocabPackSummary, SciSection, SciPhrase } from './types'
import { BUILTIN_PACKS, aggregatePackWords, aggregatePackPhrases } from './data/sci-vocab'
import type { BibTeXEntry } from './utils/bibtexParser'
import { ARTICLE_STATUS_LABEL_ZH } from './utils/articleUtils'
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
    } catch {}
    return 'md'
  })
  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale
    try { window.localStorage.setItem('scipaper.fontScale', fontScale) } catch {}
  }, [fontScale])

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem('scipaper.sidebarCollapsed') === '1' } catch { return false }
  })
  useEffect(() => {
    try { window.localStorage.setItem('scipaper.sidebarCollapsed', sidebarCollapsed ? '1' : '0') } catch {}
  }, [sidebarCollapsed])

  const [sectionNavCollapsed, setSectionNavCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem('scipaper.sectionNavCollapsed') === '1' } catch { return false }
  })
  useEffect(() => {
    try { window.localStorage.setItem('scipaper.sectionNavCollapsed', sectionNavCollapsed ? '1' : '0') } catch {}
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

  // Entering edit mode (writing) → reclaim screen for the canvas: collapse
  // both left columns and pop the AI drawer. User can still manually expand
  // them back during the session if they want to see the nav.
  useEffect(() => {
    if (focusViewMode === 'edit') {
      setSidebarCollapsed(true)
      setSectionNavCollapsed(true)
      setAiOpen(true)
    }
  }, [focusViewMode])

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
    } catch {}
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
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [theme, wizardOpen, thesisWizardOpen])

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
    await window.scipaper.llmAddProvider(draft)
    await refreshProviders()
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
      setRoute('library')
      setThesisWizardOpen(false)
      return nextState
    }, '已创建新学位论文')
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
      await window.scipaper.exportArticleLatex(selectedArticle.id)
      setNotice('LaTeX 导出成功')
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'LaTeX 导出失败')
    }
  }

  async function handleExportHTML() {
    if (!selectedArticle) return
    try {
      await window.scipaper.exportToHTML(selectedArticle.id)
      setNotice('HTML 导出成功')
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'HTML 导出失败')
    }
  }

  async function handleExportJSON() {
    if (!selectedArticle) return
    try {
      await window.scipaper.exportToJSON(selectedArticle.id)
      setNotice('JSON 导出成功')
    } catch (error) {
      console.error(error)
      setNotice(error instanceof Error ? error.message : 'JSON 导出失败')
    }
  }

  async function handleCreateSharePackage() {
    if (!selectedArticle) return
    try {
      await window.scipaper.createSharePackage(selectedArticle.id)
      setNotice('分享包创建成功')
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

  function openArticle(id: string) {
    setSelectedArticleId(id)
    setArticleTab('Introduction')
    setRoute('article')
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
        contextHint={
          selectedArticle
            ? `当前文章: ${selectedArticle.title}${isSectionTab(articleTab) ? ' · ' + articleTab : ''}`
            : undefined
        }
        onOpenSettings={() => {
          setAiOpen(false)
          setPendingSettingsFocus('ai')
          setRoute('settings')
        }}
        scenarios={scenarios.filter((s) => s.enabled)}
        currentScenarioId={currentScenarioId}
        onChangeScenario={setCurrentScenarioId}
      />

      <ApprovalDialog
        request={approvalRequest}
        onApprove={(callId, alwaysAllow) => handleApprove(callId, alwaysAllow)}
        onReject={(callId) => handleReject(callId)}
      />

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
              onOpenThesis={() => {
                setNotice('学位论文专属编辑视图待补,先看 Library 卡片信息。')
              }}
              onNewArticle={() => setWizardOpen(true)}
              onNewThesis={() => setThesisWizardOpen(true)}
            />
          ) : null}

          {state && route === 'daily' ? (
            <DailyLogView
              state={state}
              onAddProgressEntry={handleAddProgressEntry}
              onDeleteProgressEntry={handleDeleteProgressEntry}
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
              vocabPackSummaries={vocabPackSummaries}
              customVocabPacks={customVocabPacks}
              onToggleVocabPack={handleToggleVocabPack}
              onImportVocabPack={handleImportVocabPack}
              onDeleteVocabPack={handleDeleteVocabPack}
              onRenameVocabPack={handleRenameVocabPack}
              initialFocus={pendingSettingsFocus}
              onFocusConsumed={() => setPendingSettingsFocus(null)}
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
              <header className={`workspace-top${metaExpanded ? '' : ' workspace-top--collapsed'}`}>
                <div className="meta-heading">
                  <p className="eyebrow">Manuscript Dashboard</p>
                  <h2>{selectedArticle.title}</h2>
                </div>
                <div className="meta-toggle-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setMetaExpanded((v) => !v)}
                    title={metaExpanded ? '折叠元信息' : '展开以编辑标题/期刊/状态'}
                  >
                    {metaExpanded ? '折叠元信息' : '展开元信息'}
                  </button>
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

                <div className="header-actions">
                  <button className="ghost-button" onClick={() => window.scipaper.exportMarkdown(selectedArticle.id)} type="button">
                    导出 Markdown
                  </button>
                  <select
                    className="ghost-button"
                    value={docxTemplate}
                    onChange={(event) => setDocxTemplate(event.target.value)}
                    title="docx 模板"
                  >
                    <option value="academic-en">通用学术 (英文)</option>
                    <option value="thesis-zh">中文学位论文</option>
                    <option value="nature">Nature 风格</option>
                  </select>
                  <label
                    className="ghost-button"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                    title={
                      docxApplyItalic
                        ? '导出前调 LLM 按拉丁/学名规范自动加斜体（按 Settings → 拉丁斜体规范 的 prompt）'
                        : '勾选后导出前会调 LLM 给学名/拉丁短语等加斜体（成本更高、更慢）'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={docxApplyItalic}
                      onChange={(event) => setDocxApplyItalic(event.target.checked)}
                    />
                    套斜体规范
                  </label>
                  <button
                    className="ghost-button"
                    disabled={docxBusy}
                    onClick={async () => {
                      try {
                        setDocxBusy(true)
                        await window.scipaper.exportArticleDocx(
                          selectedArticle.id,
                          docxTemplate,
                          docxApplyItalic,
                        )
                      } catch (err) {
                        alert('导出失败: ' + (err instanceof Error ? err.message : String(err)))
                      } finally {
                        setDocxBusy(false)
                      }
                    }}
                    type="button"
                  >
                    {docxBusy ? '导出中…' : '导出 docx'}
                  </button>
                  <button className="ghost-button" onClick={handleExportLatex} type="button" title="导出 LaTeX 工程（.tex + references.bib + 图片）">
                    导出 LaTeX
                  </button>
                  <button className="ghost-button" onClick={handleExportHTML} type="button">
                    导出 HTML
                  </button>
                  <button className="ghost-button" onClick={handleExportJSON} type="button">
                    导出 JSON
                  </button>
                  <button className="ghost-button" onClick={handleCreateSharePackage} type="button">
                    分享包
                  </button>
                  <button className="primary-button" disabled={busy} onClick={saveMeta} type="button">
                    保存信息
                  </button>
                </div>
              </header>

              <div className={`workspace-grid${sectionNavCollapsed ? ' is-nav-collapsed' : ''}`}>
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

                  <div className="nav-group">
                    {selectedArticle.sections.map((section) => (
                      <button
                        key={section.id}
                        className={`nav-chip ${articleTab === section.type ? 'active' : ''}`}
                        onClick={() => setArticleTab(section.type)}
                        type="button"
                        title={SECTION_LABELS[section.type]}
                      >
                        <span className="nav-chip-label">{SECTION_LABELS[section.type]}</span>
                        <span className="nav-chip-glyph" aria-hidden>{SECTION_LABELS[section.type].slice(0, 1)}</span>
                        <em>{section.contentBlocks.length}</em>
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
                    <FocusModeEditor
                      // 强制按 block.id / section.id 切换时 remount。否则 dirty
                      // 守卫在 P0-6 加上后，外部 sync 会跳过覆盖，旧 block 的
                      // ProseMirror 状态会被错位写到新 block 上。
                      key={`${focusSection.id}:${focusBlock?.id ?? 'empty'}`}
                      article={selectedArticle}
                      section={focusSection}
                      block={focusBlock}
                      annotations={focusBlock?.annotations ?? []}
                      onSave={focusModeSave}
                      onAddAnnotation={async (payload) => {
                        if (!selectedArticleId || !focusBlock) return
                        const next = await window.scipaper.addAnnotation(
                          selectedArticleId,
                          focusBlock.id,
                          payload,
                        )
                        setState(next)
                      }}
                      onUpdateAnnotation={async (id, patch) => {
                        if (!selectedArticleId) return
                        const next = await window.scipaper.updateAnnotation(selectedArticleId, id, patch)
                        setState(next)
                      }}
                      onDeleteAnnotation={async (id) => {
                        if (!selectedArticleId) return
                        const next = await window.scipaper.deleteAnnotation(selectedArticleId, id)
                        setState(next)
                      }}
                      onExit={() => setArticleTab('Outline')}
                      onRecordVersion={async (changeDescription) => {
                        if (!selectedArticleId || !focusBlock) return
                        const next = await window.scipaper.recordBlockVersion(
                          selectedArticleId,
                          focusBlock.id,
                          changeDescription,
                        )
                        setState(next)
                      }}
                      viewMode={focusViewMode}
                      onViewModeChange={setFocusViewMode}
                      mergedWords={mergedVocabWords}
                      mergedPhrases={mergedVocabPhrases}
                      previewSlot={
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
                      onAddComment={(roundId, payload) =>
                        mutate(() => window.scipaper.addReviewComment(selectedArticle.id, roundId, payload), '审稿意见已保存')
                      }
                      onAddRevision={(roundId, commentId, payload) =>
                        mutate(
                          () => window.scipaper.addRevision(selectedArticle.id, roundId, commentId, payload),
                          '修改记录已保存',
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
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </>
  )
}

export default App

import { useEffect, useRef, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'

export type AssistantMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; pending?: boolean }
  | {
      id: string
      role: 'tool'
      toolName: string
      status: 'pending' | 'approved' | 'rejected' | 'running' | 'success' | 'error'
      summary: string
      argsJson?: string
      result?: string
    }
  | { id: string; role: 'system'; text: string }

export interface ActiveProvider {
  id: string
  name: string
  model: string
  supportsToolUse: boolean
}

export interface ProviderOption {
  id: string
  name: string
  model: string
  supportsToolUse: boolean
}

export interface ScenarioOption {
  id: string
  name: string
  triggerSection?: string
}

export interface AIAssistantPanelProps {
  open: boolean
  onClose: () => void
  activeProvider: ActiveProvider | null
  providers?: ProviderOption[]
  onSwitchProvider?: (id: string) => void | Promise<void>
  messages: AssistantMessage[]
  busy: boolean
  toolCallCount: number
  onSend: (text: string) => Promise<void>
  onCancel: () => Promise<void>
  contextHint?: string
  onOpenSettings: () => void
  scenarios?: ScenarioOption[]
  currentScenarioId?: string
  onChangeScenario?: (id: string) => void
  /** Currently-targeted article title for the "文章" context row. Optional —
   *  when omitted the row is hidden so the drawer keeps working off-article
   *  (e.g. on the home / library screens). */
  articleTitle?: string
  /** Hook for the "切换" link in the article row. Wired by App.tsx to the
   *  manuscript picker (typically just routes to library). */
  onSwitchArticle?: () => void
  /** Total tool count for the head chip — design pack shows "工具 9 个". */
  availableToolCount?: number
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待确认',
  approved: '已批准',
  rejected: '已拒绝',
  running: '执行中',
  success: '成功',
  error: '失败',
}

const WIDTH_KEY = 'scipaper.aiPanelWidth'
const MIN_WIDTH = 320
const MAX_WIDTH_RATIO = 0.7
// Match design pack's 4 high-frequency presets — verbs first, then a single-
// line hint that names the concrete artifact each one touches.
const EMPTY_PRESETS = [
  {
    label: '续写当前段',
    hint: '从光标处往下接 3–5 句',
    prompt: '请基于当前段落上下文，自然地续写 3–5 句。保持现有口吻，不要重复已经说过的内容。',
  },
  {
    label: '蒸馏要点',
    hint: '把当前章节压成 5 条 bullet',
    prompt: '请把当前章节的核心论点压成 5 条 bullet：每条不超过 20 字，按重要性排序。',
  },
  {
    label: '回审稿人',
    hint: '基于最近批注起草修回回复',
    prompt: '请列出当前文章未完成的审稿意见，按优先级给出修回计划，并对每条意见起草一段中性、具体的回复。',
  },
  {
    label: '套斜体规范',
    hint: '学名 / 拉丁短语 / 统计变量',
    prompt: '请扫描当前章节，找出所有应该用斜体的内容（拉丁学名、in vivo / in vitro / et al. 等短语、统计变量 p / r / n 等），并给出修改前后的对比。',
  },
]

function readSavedWidth(): number {
  if (typeof window === 'undefined') return 420
  try {
    const v = window.localStorage.getItem(WIDTH_KEY)
    const n = v ? parseInt(v, 10) : NaN
    if (Number.isFinite(n) && n >= MIN_WIDTH) return n
  } catch {
    // Ignore saved width read failures.
  }
  return 420
}

function persistWidth(width: number) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(WIDTH_KEY, String(width)) } catch {
    // Ignore saved width persistence failures.
  }
}

export function AIAssistantPanel(props: AIAssistantPanelProps): JSX.Element | null {
  const {
    open,
    onClose,
    activeProvider,
    providers = [],
    onSwitchProvider,
    messages,
    busy,
    toolCallCount,
    onSend,
    onCancel,
    contextHint,
    onOpenSettings,
    scenarios = [],
    currentScenarioId = 'auto',
    onChangeScenario,
    articleTitle,
    onSwitchArticle,
    availableToolCount,
  } = props

  const [input, setInput] = useState('')
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set())
  const [width, setWidth] = useState<number>(() => readSavedWidth())
  const widthRef = useRef(width)
  const [resizing, setResizing] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    widthRef.current = width
  }, [width])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages.length])

  useEffect(() => {
    if (!resizing) return
    function onMove(e: MouseEvent) {
      const next = Math.min(
        Math.max(window.innerWidth - e.clientX, MIN_WIDTH),
        Math.floor(window.innerWidth * MAX_WIDTH_RATIO),
      )
      setWidth(next)
    }
    function onUp() {
      persistWidth(widthRef.current)
      setResizing(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [resizing])

  useEffect(() => {
    if (!open) {
      document.body.classList.remove('ai-drawer-open')
      document.body.style.removeProperty('--ai-drawer-width')
      return
    }
    document.body.classList.add('ai-drawer-open')
    document.body.style.setProperty('--ai-drawer-width', `${width}px`)
    return () => {
      document.body.classList.remove('ai-drawer-open')
      document.body.style.removeProperty('--ai-drawer-width')
    }
  }, [open, width])

  if (!open) return null

  function toggleToolExpand(id: string) {
    setExpandedToolIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || busy || !activeProvider) return
    setInput('')
    await onSend(text)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
    // Don't let Esc bubble to the FocusModeEditor window listener — pressing
    // Esc while typing in the AI textarea should clear/blur the input, not
    // exit immersive editing.
    if (event.key === 'Escape') {
      event.stopPropagation()
    }
  }

  const hasToolWarning = activeProvider && !activeProvider.supportsToolUse
  const showLimitWarning = toolCallCount >= 30

  return createPortal(
    <aside className="ai-drawer" style={{ width }}>
      <div
        className="ai-drawer-resizer"
        onMouseDown={(e) => {
          e.preventDefault()
          setResizing(true)
        }}
        title="拖拽调整宽度"
      />

      <header className="ai-drawer-header">
        <h2>AI 助手</h2>
        <button
          className="ai-drawer-close"
          onClick={onClose}
          type="button"
          title="关闭 (Esc)"
          aria-label="关闭"
        >
          ×
        </button>
      </header>

      <div className="ai-drawer-meta">
        {activeProvider ? (
          <div className="ai-drawer-meta-row ai-drawer-meta-row--provider provider-row">
            {providers.length > 0 && onSwitchProvider ? (
              <select
                value={activeProvider.id}
                onChange={(e) => onSwitchProvider(e.target.value)}
                disabled={busy}
                className="ai-provider-select"
                title={busy ? '会话进行中,无法切换模型' : '切换 LLM 模型'}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.model}
                  </option>
                ))}
              </select>
            ) : (
              <span className="ai-row-value">{activeProvider.name} · {activeProvider.model}</span>
            )}
            <span
              className={`ai-tools-chip tools-toggle${activeProvider.supportsToolUse ? ' is-enabled' : ' is-disabled'}`}
              title={
                activeProvider.supportsToolUse
                  ? `当前模型可调用本地 ${availableToolCount ?? ''} 个工具`
                  : '当前模型仅支持纯文本对话'
              }
            >
              <span className="tools-toggle-dot" aria-hidden />
              <span>{activeProvider.supportsToolUse ? '支持工具' : '仅文本'}</span>
              {activeProvider.supportsToolUse ? (
                <span className="chip neutral sm">
                  {availableToolCount ? `${availableToolCount} 个` : '工具'}
                </span>
              ) : null}
            </span>
          </div>
        ) : (
            <div className="ai-drawer-meta-row provider-row">
            <span className="muted-text">未配置 LLM</span>
            <button className="ghost-button" onClick={onOpenSettings} type="button">去 Settings 添加</button>
          </div>
        )}

        {onChangeScenario ? (
          <div className="ai-drawer-meta-row ai-drawer-meta-row--scope scope-row">
            <span className="ai-row-label">写作场景</span>
            <div className="ai-scope-seg" role="radiogroup" aria-label="写作场景">
            <button
              type="button"
              role="radio"
              aria-checked={currentScenarioId === 'auto'}
              className={`ai-scope-btn seg-btn${currentScenarioId === 'auto' ? ' is-active' : ''}`}
              onClick={() => onChangeScenario('auto')}
            >
              自动
            </button>
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={currentScenarioId === s.id}
                className={`ai-scope-btn seg-btn${currentScenarioId === s.id ? ' is-active' : ''}`}
                onClick={() => onChangeScenario(s.id)}
                title={s.name}
              >
                {s.name}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={currentScenarioId === 'off'}
              className={`ai-scope-btn seg-btn ai-scope-btn--off${currentScenarioId === 'off' ? ' is-active' : ''}`}
              onClick={() => onChangeScenario('off')}
              title="关闭场景，纯对话"
            >
              关闭
            </button>
            </div>
          </div>
        ) : null}

        {(articleTitle || contextHint || hasToolWarning || showLimitWarning) ? (
          <div className="ai-drawer-context">
            {articleTitle ? (
              <div className="ai-drawer-meta-row ai-drawer-meta-row--article article-row">
                <span className="ai-row-label">文章</span>
                <span className="ai-context-article ai-row-value" title={articleTitle}>
                  {articleTitle}
                </span>
                {onSwitchArticle ? (
                  <button
                    type="button"
                    className="ai-article-switch link-btn sm"
                    onClick={onSwitchArticle}
                  >
                    切换
                  </button>
                ) : null}
              </div>
            ) : null}
            {contextHint && !articleTitle ? (
              <span className="ai-context-hint">{contextHint}</span>
            ) : null}
            {hasToolWarning ? (
              <span className="ai-context-hint warning">当前模型不支持工具调用</span>
            ) : null}
            {showLimitWarning ? (
              <span className="ai-context-hint warning">已用 {toolCallCount} 次工具，接近上限</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div ref={messagesRef} className="ai-drawer-messages">
        {messages.length === 0 && (
          <div className="ai-drawer-empty">
            <div className="ai-empty-mark">AI</div>
            <h3>跟 AI 说你想做什么</h3>
            <p className="muted-text">选择任务模板，或直接描述目标。</p>
            <div className="ai-preset-list">
              {EMPTY_PRESETS.map((preset) => (
                <button
                  className="ai-preset-button"
                  disabled={busy || !activeProvider}
                  key={preset.label}
                  onClick={() => setInput(preset.prompt)}
                  type="button"
                >
                  <span>{preset.label}</span>
                  <small>{preset.hint}</small>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="ai-msg-row right">
                <div className="ai-bubble-user">{msg.text}</div>
              </div>
            )
          }
          if (msg.role === 'assistant') {
            return (
              <div key={msg.id} className="ai-msg-row left">
                <div className="ai-bubble-assistant">
                  {msg.text}
                  {msg.pending && <span className="ai-cursor">…</span>}
                </div>
              </div>
            )
          }
          if (msg.role === 'tool') {
            const expanded = expandedToolIds.has(msg.id)
            return (
              <div key={msg.id} className="ai-msg-row center">
                <button className="ai-tool-chip" onClick={() => toggleToolExpand(msg.id)} type="button">
                  <span className="chip">{STATUS_LABEL[msg.status] ?? msg.status}</span>
                  <strong>{msg.toolName}</strong>
                  <span>{msg.summary}</span>
                  {expanded && (
                    <div className="ai-tool-detail">
                      {msg.argsJson && (
                        <details open>
                          <summary>参数</summary>
                          <pre>{msg.argsJson}</pre>
                        </details>
                      )}
                      {msg.result && (
                        <details open>
                          <summary>结果</summary>
                          <pre>{msg.result}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </button>
              </div>
            )
          }
          return (
            <div key={msg.id} className="ai-msg-row center">
              <em className="ai-system-text">{msg.text}</em>
            </div>
          )
        })}
      </div>

      <footer className="ai-drawer-footer">
        <div className="ai-composer-frame">
          <textarea
            rows={3}
            placeholder={activeProvider ? '跟 AI 说你想做什么…' : '先添加 LLM Provider。'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!activeProvider || busy}
          />
          <div className="ai-composer-foot">
            <span className="ai-composer-meta">
              <span className="kbd">Enter</span> 发送
              <span className="dot-sep" aria-hidden>·</span>
              <span className="kbd">Shift</span>+<span className="kbd">Enter</span> 换行
              <span className="dot-sep" aria-hidden>·</span>
              <span className="ai-composer-tokens">
                {input.length.toLocaleString()} / 8 K tokens
              </span>
              {busy ? (
                <>
                  <span className="dot-sep" aria-hidden>·</span>
                  <span className="ai-composer-status">处理中</span>
                </>
              ) : null}
            </span>
            <div className="ai-drawer-footer-actions">
              {busy && (
                <button className="ghost-button" onClick={onCancel} type="button">中断</button>
              )}
              <button
                className="primary-button ai-send-btn"
                disabled={!input.trim() || busy || !activeProvider}
                onClick={handleSend}
                type="button"
              >
                发送
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </aside>,
    document.body,
  )
}

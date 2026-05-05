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
  } = props

  const [input, setInput] = useState('')
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set())
  const [width, setWidth] = useState<number>(() => readSavedWidth())
  const [resizing, setResizing] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)

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
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(WIDTH_KEY, String(width)) } catch {
      // Ignore saved width persistence failures.
    }
  }, [width])

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
        <div>
          <p className="eyebrow">SciPaper AI</p>
          <h2>AI 助手</h2>
        </div>
        <button className="ghost-button" onClick={onClose} type="button">关闭</button>
      </header>

      <div className="ai-drawer-meta">
        {activeProvider && providers.length > 0 && onSwitchProvider ? (
          <div className="ai-drawer-meta-row">
            <select
              value={activeProvider.id}
              onChange={(e) => onSwitchProvider(e.target.value)}
              disabled={busy}
              style={{ flex: 1, fontSize: 'var(--fs-sm)', padding: '4px 8px', minWidth: 0 }}
              title={busy ? '会话进行中,无法切换模型' : '切换 LLM 模型'}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.model}
                </option>
              ))}
            </select>
            <span className="chip">{activeProvider.supportsToolUse ? '支持工具' : '纯文本'}</span>
          </div>
        ) : activeProvider ? (
          <div className="ai-drawer-meta-row">
            <span>{activeProvider.name} · {activeProvider.model}</span>
            <span className="chip">{activeProvider.supportsToolUse ? '支持工具调用' : '纯文本'}</span>
          </div>
        ) : (
          <div className="ai-drawer-meta-row">
            <span className="muted-text">未配置 LLM</span>
            <button className="ghost-button" onClick={onOpenSettings} type="button">去 Settings 添加</button>
          </div>
        )}
        {hasToolWarning && (
          <p className="ai-context-hint warning">当前模型不支持工具调用,只能纯文本对话</p>
        )}
        {contextHint && <p className="ai-context-hint">{contextHint}</p>}
        {showLimitWarning && (
          <p className="ai-context-hint warning">已执行 {toolCallCount} 次工具调用,接近上限 50</p>
        )}

        {onChangeScenario && (
          <div className="ai-drawer-meta-row" style={{ marginTop: 'var(--sp-2)' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-ink-muted)' }}>写作场景:</span>
            <select
              value={currentScenarioId}
              onChange={(e) => onChangeScenario(e.target.value)}
              style={{ flex: 1, fontSize: 'var(--fs-xs)', padding: '2px 6px' }}
            >
              <option value="auto">自动 (跟随当前章节)</option>
              <option value="off">关闭 (纯对话)</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div ref={messagesRef} className="ai-drawer-messages">
        {messages.length === 0 && (
          <div className="ai-drawer-empty">
            <p>跟 AI 说你想做什么。</p>
            <p className="muted-text">举例: 列出我有哪些文章 / 给当前 Discussion 补一句回扣假设。</p>
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
        <textarea
          rows={3}
          placeholder="跟 AI 说你想做什么。Enter 发送,Shift+Enter 换行。"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!activeProvider || busy}
        />
        <div className="ai-drawer-footer-actions">
          {busy && (
            <button className="ghost-button" onClick={onCancel} type="button">中断</button>
          )}
          <button
            className="primary-button"
            disabled={!input.trim() || busy || !activeProvider}
            onClick={handleSend}
            type="button"
          >
            发送
          </button>
        </div>
      </footer>
    </aside>,
    document.body,
  )
}

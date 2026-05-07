import { useState } from 'react'
import type { JSX } from 'react'

export interface LlmProvider {
  id: string
  name: string
  kind: 'openai-compat' | 'anthropic'
  baseUrl: string
  model: string
  hasApiKey: boolean
  temperature?: number
  maxTokens?: number
  supportsToolUse: boolean
  trustForWrite?: boolean
}

export interface LlmProvidersState {
  providers: LlmProvider[]
  activeId: string | null
  presets: LlmPreset[]
}

export interface LlmPreset {
  presetId: string
  name: string
  kind: 'openai-compat' | 'anthropic'
  baseUrl: string
  defaultModel: string
  description: string
  supportsToolUse: boolean
}

interface Props {
  providers: LlmProvider[]
  activeId: string | null
  presets: LlmPreset[]
  onAdd: (draft: Omit<LlmProvider, 'id' | 'hasApiKey'> & { apiKey: string }) => Promise<LlmProvidersState | void>
  onUpdate: (id: string, patch: Partial<Omit<LlmProvider, 'id' | 'hasApiKey'>> & { apiKey?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSetActive: (id: string) => Promise<void>
  onTest: (id: string) => Promise<{ ok: boolean; message: string }>
}

type Draft = {
  name: string
  kind: 'openai-compat' | 'anthropic'
  baseUrl: string
  model: string
  supportsToolUse: boolean
  trustForWrite: boolean
  temperature: string
  maxTokens: string
  apiKey: string
}

const emptyDraft: Draft = {
  name: '',
  kind: 'openai-compat',
  baseUrl: '',
  model: '',
  supportsToolUse: false,
  trustForWrite: false,
  temperature: '0',
  maxTokens: '',
  apiKey: '',
}

export function ProviderManager(props: Props): JSX.Element {
  const { providers, activeId, presets, onAdd, onUpdate, onDelete, onSetActive, onTest } = props
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addDraft, setAddDraft] = useState<Draft>({ ...emptyDraft })
  const [editDraft, setEditDraft] = useState<Draft>({ ...emptyDraft })
  const [tests, setTests] = useState<Record<string, { state: 'idle' | 'loading' | 'ok' | 'error'; msg: string }>>({})

  function scheduleTestClear(id: string) {
    window.setTimeout(() => {
      setTests(prev => { const n = { ...prev }; delete n[id]; return n })
    }, 5000)
  }

  function startAddFromPreset(p: LlmPreset) {
    const dft = (p as { defaultMaxTokens?: number }).defaultMaxTokens
    setAddDraft({ name: p.name, kind: p.kind, baseUrl: p.baseUrl, model: p.defaultModel, supportsToolUse: p.supportsToolUse, trustForWrite: false, temperature: '0', maxTokens: dft ? String(dft) : '', apiKey: '' })
    setShowAdd(true)
  }

  function startEdit(p: LlmProvider) {
    setEditDraft({ name: p.name, kind: p.kind, baseUrl: p.baseUrl, model: p.model, supportsToolUse: p.supportsToolUse, trustForWrite: p.trustForWrite ?? false, temperature: p.temperature?.toString() ?? '0', maxTokens: p.maxTokens?.toString() ?? '', apiKey: '' })
    setEditingId(p.id)
  }

  function isValidDraft(draft: Draft, isAdd: boolean) {
    if (!draft.name.trim() || !draft.baseUrl.trim() || !draft.model.trim()) return false
    if (isAdd && !draft.apiKey.trim()) return false
    const temperature = draft.temperature.trim()
    if (temperature) {
      const parsed = Number(temperature)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) return false
    }
    const maxTokens = draft.maxTokens.trim()
    if (maxTokens) {
      const parsed = Number(maxTokens)
      if (!Number.isInteger(parsed) || parsed < 1) return false
    }
    return true
  }

  function draftToPayload(draft: Draft) {
    return {
      name: draft.name.trim(),
      kind: draft.kind,
      baseUrl: draft.baseUrl.trim(),
      model: draft.model.trim(),
      supportsToolUse: draft.supportsToolUse,
      trustForWrite: draft.trustForWrite,
      temperature: draft.temperature.trim() ? parseFloat(draft.temperature) : 0,
      maxTokens: draft.maxTokens.trim() ? parseInt(draft.maxTokens, 10) : undefined,
    }
  }

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidDraft(addDraft, true)) return
    await onAdd({ ...draftToPayload(addDraft), apiKey: addDraft.apiKey.trim() })
    setShowAdd(false)
    setAddDraft({ ...emptyDraft })
  }

  async function submitEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    if (!isValidDraft(editDraft, false)) return
    const patch: Partial<Omit<LlmProvider, 'id' | 'hasApiKey'>> & { apiKey?: string } = draftToPayload(editDraft)
    if (editDraft.apiKey.trim()) patch.apiKey = editDraft.apiKey.trim()
    await onUpdate(id, patch)
    setEditingId(null)
  }

  async function submitAddAndTest() {
    if (!isValidDraft(addDraft, true)) return
    const data = await onAdd({ ...draftToPayload(addDraft), apiKey: addDraft.apiKey.trim() })
    const newActiveId = data?.activeId
    setShowAdd(false)
    setAddDraft({ ...emptyDraft })
    if (newActiveId) await runTest(newActiveId)
  }

  async function submitEditAndTest(id: string) {
    if (!isValidDraft(editDraft, false)) return
    const patch: Partial<Omit<LlmProvider, 'id' | 'hasApiKey'>> & { apiKey?: string } = draftToPayload(editDraft)
    if (editDraft.apiKey.trim()) patch.apiKey = editDraft.apiKey.trim()
    await onUpdate(id, patch)
    setEditingId(null)
    await runTest(id)
  }

  async function runTest(id: string) {
    setTests(prev => ({ ...prev, [id]: { state: 'loading', msg: '' } }))
    try {
      const res = await onTest(id)
      setTests(prev => ({ ...prev, [id]: { state: res.ok ? 'ok' : 'error', msg: res.message } }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : '测试失败'
      setTests(prev => ({ ...prev, [id]: { state: 'error', msg } }))
    }
    scheduleTestClear(id)
  }

  function formUI(draft: Draft, setDraft: React.Dispatch<React.SetStateAction<Draft>>, onSubmit: (e: React.FormEvent) => void, onCancel: () => void, isAdd: boolean, hasKey?: boolean, onSaveAndTest?: () => Promise<void>) {
    const canSubmit = isValidDraft(draft, isAdd)
    return (
      <form onSubmit={onSubmit} className="tag-form">
        <label className="field"><span>Name</span><input value={draft.name} onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))} placeholder="Provider 名称" required /></label>
        <div className="form-grid">
          <label className="field"><span>Kind</span><select value={draft.kind} onChange={e => setDraft(prev => ({ ...prev, kind: e.target.value as 'openai-compat' | 'anthropic' }))}><option value="openai-compat">openai-compat</option><option value="anthropic">anthropic</option></select></label>
          <label className="field"><span>Model</span><input value={draft.model} onChange={e => setDraft(prev => ({ ...prev, model: e.target.value }))} placeholder="模型标识" required /></label>
        </div>
        <label className="field"><span>Base URL</span><input value={draft.baseUrl} onChange={e => setDraft(prev => ({ ...prev, baseUrl: e.target.value }))} placeholder="https://api.example.com/v1" required /></label>
        <div className="form-grid">
          <label className="field"><span>Temperature</span><input type="number" step="0.1" min="0" max="2" value={draft.temperature} onChange={e => setDraft(prev => ({ ...prev, temperature: e.target.value }))} placeholder="默认 0, 取值 0-2" /></label>
          <label className="field"><span>Max Output Tokens</span><input type="number" min="1" value={draft.maxTokens} onChange={e => setDraft(prev => ({ ...prev, maxTokens: e.target.value }))} placeholder="DeepSeek V4 上限 384000" /></label>
        </div>
        <label className="field"><span>API Key</span><input type="password" value={draft.apiKey} onChange={e => setDraft(prev => ({ ...prev, apiKey: e.target.value }))} placeholder={isAdd ? '粘贴你的 API Key' : hasKey ? '已保存,留空不修改' : '粘贴你的 API Key'} required={isAdd} /></label>
        <label className="checkbox-row"><input type="checkbox" checked={draft.supportsToolUse} onChange={e => setDraft(prev => ({ ...prev, supportsToolUse: e.target.checked }))} /><span>Supports Tool Use</span></label>
        <label className="checkbox-row"><input type="checkbox" checked={draft.trustForWrite} onChange={e => setDraft(prev => ({ ...prev, trustForWrite: e.target.checked }))} /><span>Trust for Write</span></label>
        <p className="muted-text" style={{ fontSize: 'var(--fs-xs)', marginLeft: '24px' }}>新增后会自动设为默认 Provider。信任后写操作自动批准,使用前请确认 prompt 安全</p>
        {!canSubmit && <p className="muted-text" style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-danger)' }}>请填写名称、Base URL、模型和 API Key；Temperature 需在 0-2 之间。</p>}
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button className="primary-button" type="submit" disabled={!canSubmit}>{isAdd ? '添加' : '保存'}</button>
          {onSaveAndTest ? (
            <button className="ghost-button" type="button" disabled={!canSubmit} onClick={onSaveAndTest}>
              {isAdd ? '添加并测试' : '保存并测试'}
            </button>
          ) : null}
          <button className="ghost-button" type="button" onClick={onCancel}>取消</button>
        </div>
      </form>
    )
  }

  return (
    <section className="panel-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AI Providers</p>
          <h3>外接大模型</h3>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', alignItems: 'center' }}>
        <button className="primary-button" onClick={() => { setAddDraft({ ...emptyDraft }); setShowAdd(true) }} type="button">+ 添加 Provider</button>
        {presets.slice(0, 4).map(p => (
          <button key={p.presetId} className="ghost-button" onClick={() => startAddFromPreset(p)} type="button">{p.name}</button>
        ))}
      </div>

      {showAdd && <div className="panel-card">{formUI(addDraft, setAddDraft, submitAdd, () => { setShowAdd(false); setAddDraft({ ...emptyDraft }) }, true, undefined, submitAddAndTest)}</div>}

      {providers.length === 0 && !showAdd && <p className="empty-text">暂无 Provider</p>}

      {providers.map(p => {
        const t = tests[p.id] || { state: 'idle' as const, msg: '' }
        return (
          <div key={p.id} className="panel-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', minWidth: 0 }}>
                <input type="radio" name="active-provider" checked={activeId === p.id} onChange={() => onSetActive(p.id)} title="设为默认" />
                <strong style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}>{p.name}</strong>
                <span style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)', color: 'var(--c-ink-muted)', padding: '2px 8px', background: 'var(--c-panel-sub)', borderRadius: 'var(--r-pill)', border: '1px solid var(--c-line)', whiteSpace: 'nowrap' }}>{p.kind}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexWrap: 'wrap', flex: 1, minWidth: 0, justifyContent: 'center' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-ink-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{p.baseUrl}</span>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-ink)' }}>{p.model}</span>
                <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 'var(--r-pill)', background: p.supportsToolUse ? 'var(--c-accent-soft)' : 'var(--c-panel-sub)', color: p.supportsToolUse ? 'var(--c-accent-strong)' : 'var(--c-ink-muted)', border: '1px solid var(--c-line)', whiteSpace: 'nowrap' }}>{p.supportsToolUse ? '支持工具' : '纯生成'}</span>
                <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 'var(--r-pill)', background: p.hasApiKey ? 'rgba(46,139,87,0.12)' : 'rgba(181,68,58,0.12)', color: p.hasApiKey ? 'var(--c-success)' : 'var(--c-danger)', border: '1px solid var(--c-line)', whiteSpace: 'nowrap' }}>{p.hasApiKey ? '已保存' : '未填'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <button className="ghost-button" onClick={() => runTest(p.id)} disabled={t.state === 'loading'} type="button" style={{ color: t.state === 'ok' ? 'var(--c-success)' : t.state === 'error' ? 'var(--c-danger)' : undefined }}>
                  {t.state === 'loading' ? '测试中…' : t.state === 'ok' ? '✓ ok' : t.state === 'error' ? `✗ ${t.msg}` : '测试连接'}
                </button>
                <button className="ghost-button" onClick={() => startEdit(p)} type="button">编辑</button>
                <button className="ghost-button" onClick={() => onDelete(p.id)} type="button">删除</button>
              </div>
            </div>

            {editingId === p.id && formUI(editDraft, setEditDraft, e => submitEdit(e, p.id), () => setEditingId(null), false, p.hasApiKey, () => submitEditAndTest(p.id))}
          </div>
        )
      })}
    </section>
  )
}

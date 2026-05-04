import { useMemo, useRef, useState, type JSX } from 'react'
import type { VocabPack, VocabPackSummary, SciSection } from '../types'
import { BUILTIN_PACKS } from '../data/sci-vocab'

interface VocabPackSettingsProps {
  summaries: VocabPackSummary[]
  customPacks: VocabPack[]
  onToggle: (id: string, enabled: boolean) => Promise<void>
  onImport: (payload: {
    name: string
    description?: string
    words: string[] | Partial<Record<SciSection, string[]>>
  }) => Promise<VocabPack>
  onDelete: (id: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
}

interface PackRow extends VocabPackSummary {
  wordCount: number
  phraseCount: number
}

function countPack(pack: VocabPack): { words: number; phrases: number } {
  const sections: SciSection[] = ['general', 'introduction', 'methods', 'results', 'discussion']
  let words = 0
  let phrases = 0
  for (const s of sections) {
    words += pack.words[s]?.length ?? 0
    phrases += pack.phrases[s]?.length ?? 0
  }
  return { words, phrases }
}

/** Parse .txt (one word per line) or .json ({words, phrases?} or {general:[...]}). */
async function parseImportFile(file: File): Promise<{ words: string[] | Partial<Record<SciSection, string[]>> }> {
  const text = await file.text()
  if (file.name.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(text)
    if (Array.isArray(data)) return { words: data.filter((w) => typeof w === 'string') }
    if (data && typeof data === 'object' && 'words' in data) return { words: data.words }
    return { words: data as Partial<Record<SciSection, string[]>> }
  }
  const words = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[#/].*$/, '').trim())
    .filter(Boolean)
  return { words }
}

export function VocabPackSettings(props: VocabPackSettingsProps): JSX.Element {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [importName, setImportName] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // Merge summaries with the per-pack word/phrase counts.
  const rows: PackRow[] = useMemo(() => {
    const counts = new Map<string, { words: number; phrases: number }>()
    for (const p of BUILTIN_PACKS) counts.set(p.id, countPack(p))
    for (const p of props.customPacks) counts.set(p.id, countPack(p))
    return props.summaries.map((s) => {
      const c = counts.get(s.id) ?? { words: 0, phrases: 0 }
      return { ...s, wordCount: c.words, phraseCount: c.phrases }
    })
  }, [props.summaries, props.customPacks])

  const builtinRows = rows.filter((r) => r.builtin)
  const customRows = rows.filter((r) => !r.builtin)

  async function handleToggle(id: string, enabled: boolean) {
    setBusy(true)
    try {
      await props.onToggle(id, enabled)
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    setImportError(null)
    if (!pendingFile) {
      setImportError('请先选择 .txt 或 .json 文件')
      return
    }
    if (!importName.trim()) {
      setImportError('请填写 pack 名称')
      return
    }
    setBusy(true)
    try {
      const parsed = await parseImportFile(pendingFile)
      await props.onImport({ name: importName.trim(), words: parsed.words })
      setPendingFile(null)
      setImportName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`确定删除 "${name}" 这个补全 pack？该操作不可撤销。`)) return
    setBusy(true)
    try {
      await props.onDelete(id)
    } finally {
      setBusy(false)
    }
  }

  async function commitRename(id: string) {
    const name = renameValue.trim()
    if (!name) {
      setRenamingId(null)
      return
    }
    setBusy(true)
    try {
      await props.onRename(id, name)
      setRenamingId(null)
      setRenameValue('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel-stack" style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <section className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Vocab packs</p>
            <h3>内置词库（{builtinRows.length}）</h3>
            <p>启用想要的领域包；默认只开通用学术 + 通用分子生物 + IMRaD 框架词。</p>
          </div>
        </div>
        <ul className="plain-list" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
          {builtinRows.map((row) => (
            <li
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                gap: 'var(--sp-3)',
                alignItems: 'center',
                padding: 'var(--sp-3)',
                border: '1px solid var(--c-line)',
                borderRadius: 'var(--r-md)',
                background: row.enabled ? 'var(--c-accent-soft)' : 'var(--c-panel)',
                borderColor: row.enabled ? 'var(--c-accent)' : 'var(--c-line)',
              }}
            >
              <input
                type="checkbox"
                checked={row.enabled}
                disabled={busy}
                onChange={(e) => handleToggle(row.id, e.target.checked)}
                aria-label={`启用/禁用 ${row.name}`}
              />
              <div>
                <div style={{ fontWeight: 'var(--fw-semi)' }}>{row.name}</div>
                <div className="muted-text" style={{ fontSize: 'var(--fs-xs)' }}>{row.description}</div>
              </div>
              <div className="muted-text" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' }}>
                {row.wordCount} 词{row.phraseCount > 0 ? ` · ${row.phraseCount} 短语` : ''}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Custom packs</p>
            <h3>用户导入（{customRows.length}）</h3>
            <p>从 .txt（一行一词）或 .json 导入；可重命名、启停、删除。</p>
          </div>
        </div>

        {customRows.length > 0 ? (
          <ul className="plain-list" style={{ display: 'grid', gap: 'var(--sp-2)' }}>
            {customRows.map((row) => (
              <li
                key={row.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 'var(--sp-3)',
                  alignItems: 'center',
                  padding: 'var(--sp-3)',
                  border: '1px solid var(--c-line)',
                  borderRadius: 'var(--r-md)',
                  background: row.enabled ? 'var(--c-accent-soft)' : 'var(--c-panel)',
                  borderColor: row.enabled ? 'var(--c-accent)' : 'var(--c-line)',
                }}
              >
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={busy}
                  onChange={(e) => handleToggle(row.id, e.target.checked)}
                  aria-label={`启用/禁用 ${row.name}`}
                />
                <div>
                  {renamingId === row.id ? (
                    <input
                      type="text"
                      value={renameValue}
                      autoFocus
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(row.id)
                        if (e.key === 'Escape') {
                          setRenamingId(null)
                          setRenameValue('')
                        }
                      }}
                      style={{ width: '100%', padding: '4px 6px' }}
                    />
                  ) : (
                    <div style={{ fontWeight: 'var(--fw-semi)' }}>{row.name}</div>
                  )}
                  <div className="muted-text" style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)' }}>
                    id: {row.id} · {row.wordCount} 词{row.phraseCount > 0 ? ` · ${row.phraseCount} 短语` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => {
                      setRenamingId(row.id)
                      setRenameValue(row.name)
                    }}
                  >
                    重命名
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => handleDelete(row.id, row.name)}
                    style={{ color: 'var(--c-danger, #b94a48)' }}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">还没导入过自定义 pack。</p>
        )}

        <div style={{ marginTop: 'var(--sp-4)', display: 'grid', gap: 'var(--sp-2)' }}>
          <h4 style={{ margin: 0, fontSize: 'var(--fs-sm)' }}>导入新 pack</h4>
          <input
            type="text"
            placeholder="pack 名称（如：我的实验室词库）"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            disabled={busy}
            style={{ padding: '6px 8px' }}
          />
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.json"
            onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          <p className="muted-text" style={{ fontSize: 'var(--fs-xs)' }}>
            .txt：一行一词（# 开头当注释）。.json：可以是 ["w1","w2"] 数组、{`{"words":[...]}`}，或按 IMRaD 段分桶 {`{"general":[],"methods":[]}`}。
          </p>
          <div>
            <button type="button" className="primary-button" disabled={busy || !pendingFile || !importName.trim()} onClick={handleImport}>
              {busy ? '导入中…' : '导入并启用'}
            </button>
          </div>
          {importError && <p style={{ color: 'var(--c-danger, #b94a48)', fontSize: 'var(--fs-xs)' }}>{importError}</p>}
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">使用方式</p>
            <h3>提示</h3>
          </div>
        </div>
        <div className="plain-list" style={{ display: 'grid', gap: 'var(--sp-1)', fontSize: 'var(--fs-sm)' }}>
          <p>· 启用/禁用立即生效；下次进入沉浸写作就能看到变化。</p>
          <p>· 启用很多 pack 不会卡 — 候选会按段（general / introduction / methods / results / discussion）分桶过滤。</p>
          <p>· MCP 端可以通过 <code>list_vocab_packs / set_vocab_pack_enabled / import_vocab_pack / delete_vocab_pack / rename_vocab_pack</code> 程序化操作。</p>
          <p>· 用户自定义短词条仍可用 <code>add_vocab_word / add_vocab_phrase</code> 直接进 user-default 词库（与 pack 系统并行）。</p>
        </div>
      </section>
    </section>
  )
}

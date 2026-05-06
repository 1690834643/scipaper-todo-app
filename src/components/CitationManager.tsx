import { useState } from 'react'
import type { Article, Citation } from '../types'
import { parseBibTeX, formatAuthors, type BibTeXEntry } from '../utils/bibtexParser'

interface CitationManagerProps {
  article: Article
  onAddCitation: (citation: BibTeXEntry) => Promise<void>
  onUpdateCitation: (citationId: string, patch: Partial<Citation>) => Promise<void>
  onDeleteCitation: (citationId: string) => Promise<void>
}

export function CitationManager({ article, onAddCitation, onUpdateCitation, onDeleteCitation }: CitationManagerProps) {
  const [bibtexInput, setBibtexInput] = useState('')
  const [parsedEntries, setParsedEntries] = useState<BibTeXEntry[]>([])
  const [showImport, setShowImport] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Citation>>({})

  function handleParse() {
    const entries = parseBibTeX(bibtexInput)
    setParsedEntries(entries)
  }

  async function handleImport(entry: BibTeXEntry) {
    await onAddCitation(entry)
    setParsedEntries(prev => prev.filter(e => e.key !== entry.key))
    if (parsedEntries.length <= 1) {
      setBibtexInput('')
      setShowImport(false)
    }
  }

  function startEdit(citation: Citation) {
    setEditingId(citation.id ?? null)
    setEditDraft({
      title: citation.title || '',
      authors: citation.authors || '',
      year: citation.year || '',
      journal: citation.journal || '',
      doi: citation.doi || '',
      url: citation.url || '',
    })
  }

  async function saveEdit(citationId: string) {
    await onUpdateCitation(citationId, editDraft)
    setEditingId(null)
    setEditDraft({})
  }

  return (
    <section className="panel-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Citations</p>
          <h3>参考文献管理</h3>
        </div>
        <button 
          className="ghost-button" 
          onClick={() => setShowImport(!showImport)}
          type="button"
        >
          {showImport ? '取消导入' : '导入 BibTeX'}
        </button>
      </div>

      {showImport && (
        <div className="citation-import">
          <label className="field">
            <span>粘贴 BibTeX</span>
            <textarea
              rows={6}
              value={bibtexInput}
              onChange={(e) => setBibtexInput(e.target.value)}
              placeholder="@article{key, title={...}, author={...}, year={...}}"
            />
          </label>
          <div className="citation-actions">
            <button className="ghost-button" onClick={handleParse} type="button">
              解析
            </button>
          </div>

          {parsedEntries.length > 0 && (
            <div className="parsed-entries">
              <p className="eyebrow">解析结果</p>
              {parsedEntries.map(entry => (
                <div key={entry.key} className="citation-entry">
                  <div className="citation-info">
                    <strong>{entry.title}</strong>
                    <p>{formatAuthors(entry.authors)} ({entry.year})</p>
                    {entry.journal && <p className="citation-journal">{entry.journal}</p>}
                  </div>
                  <button 
                    className="primary-button" 
                    onClick={() => handleImport(entry)}
                    type="button"
                  >
                    导入
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="citation-list">
        {article.citations && article.citations.length > 0 ? (
          article.citations.map((citation: Citation, index: number) => (
            <div key={citation.id ?? index} className="citation-item">
              {editingId && editingId === citation.id ? (
                <div className="citation-import" style={{ width: '100%' }}>
                  <div className="form-grid">
                    <label className="field">
                      <span>题名</span>
                      <input value={editDraft.title || ''} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>作者</span>
                      <input value={editDraft.authors || ''} onChange={(e) => setEditDraft({ ...editDraft, authors: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>年份</span>
                      <input value={editDraft.year || ''} onChange={(e) => setEditDraft({ ...editDraft, year: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>期刊</span>
                      <input value={editDraft.journal || ''} onChange={(e) => setEditDraft({ ...editDraft, journal: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>DOI</span>
                      <input value={editDraft.doi || ''} onChange={(e) => setEditDraft({ ...editDraft, doi: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>URL</span>
                      <input value={editDraft.url || ''} onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })} />
                    </label>
                  </div>
                  <div className="citation-actions">
                    <button className="primary-button" type="button" onClick={() => citation.id && saveEdit(citation.id)}>
                      保存参考文献
                    </button>
                    <button className="ghost-button" type="button" onClick={() => setEditingId(null)}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="citation-info">
                    <strong>{citation.title || '未命名'}</strong>
                    <p>{citation.authors || '未知作者'} ({citation.year || '未知年份'})</p>
                    {citation.journal && <p className="citation-journal">{citation.journal}</p>}
                  </div>
                  {citation.doi && (
                    <a
                      className="citation-doi"
                      href={`https://doi.org/${citation.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      DOI
                    </a>
                  )}
                  <button className="ghost-button" type="button" onClick={() => startEdit(citation)} disabled={!citation.id}>
                    编辑
                  </button>
                  <button
                    className="ghost-button danger"
                    type="button"
                    onClick={() => {
                      if (citation.id && confirm('确定删除这条参考文献？')) onDeleteCitation(citation.id)
                    }}
                    disabled={!citation.id}
                  >
                    删除
                  </button>
                </>
              )}
            </div>
          ))
        ) : (
          <div className="empty-panel">
            <p>暂无参考文献</p>
          </div>
        )}
      </div>
    </section>
  )
}

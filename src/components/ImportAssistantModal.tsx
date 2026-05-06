import { useEffect, useMemo, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import type { AppState, Article } from '../types'
import { parseManuscriptDraft, parseReviewLetter } from '../utils/importParsers'

type ImportMode = 'manuscript' | 'review'
type WriteMode = 'append' | 'replace'

interface ImportAssistantModalProps {
  open: boolean
  article: Article | null
  busy: boolean
  onClose: () => void
  onApplied: (nextState: AppState, message: string) => void | Promise<void>
  onError: (message: string) => void
  defaultMode?: ImportMode
}

const MODE_LABELS: Record<ImportMode, string> = {
  manuscript: '手稿正文',
  review: '审稿意见',
}

export function ImportAssistantModal(props: ImportAssistantModalProps): JSX.Element | null {
  const { open, article, busy, onClose, onApplied, onError, defaultMode = 'manuscript' } = props
  const [mode, setMode] = useState<ImportMode>('manuscript')
  const [writeMode, setWriteMode] = useState<WriteMode>('append')
  const [targetRoundId, setTargetRoundId] = useState('__new__')
  const [text, setText] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [applying, setApplying] = useState(false)
  const [reformatting, setReformatting] = useState(false)

  const manuscriptSections = useMemo(() => parseManuscriptDraft(text), [text])
  const reviewGroups = useMemo(() => parseReviewLetter(text), [text])

  useEffect(() => {
    if (open) setMode(defaultMode)
  }, [open, defaultMode])

  if (!open) return null

  const hasPreview = mode === 'manuscript' ? manuscriptSections.length > 0 : reviewGroups.length > 0
  const disabled = busy || applying || !article || !hasPreview

  async function chooseFile() {
    try {
      const selected = await window.scipaper.selectImportTextFile()
      if (!selected) return
      setText(selected.text)
      setSourceName(selected.fileName)
    } catch (error) {
      onError(error instanceof Error ? error.message : '文件读取失败')
    }
  }

  async function applyImport() {
    if (!article || disabled) return
    setApplying(true)
    try {
      if (mode === 'manuscript') {
        const nextState = await window.scipaper.importManuscriptSections(
          article.id,
          manuscriptSections.map((section) => ({
            sectionType: section.sectionType,
            content: section.content,
            description: sourceName ? `Imported manuscript draft: ${sourceName}` : 'Imported manuscript draft',
            sourceName,
          })),
          writeMode,
        )
        onApplied(nextState, writeMode === 'replace' ? '手稿正文已导入并替换章节' : '手稿正文已追加导入')
      } else {
        const nextState = await window.scipaper.importReviewComments(article.id, {
          roundId: targetRoundId === '__new__' ? undefined : targetRoundId,
          submittedAt: new Date().toISOString().slice(0, 10),
          journalName: article.targetJournal,
          manuscriptNumber: '',
          reviewReceivedAt: new Date().toISOString().slice(0, 10),
          sourceName,
          groups: reviewGroups,
        })
        onApplied(nextState, '审稿意见已导入')
      }
      setText('')
      setSourceName('')
      onClose()
    } catch (error) {
      onError(error instanceof Error ? error.message : '导入失败')
    } finally {
      setApplying(false)
    }
  }

  async function undoLastImport() {
    if (!article || applying) return
    setApplying(true)
    try {
      const nextState = await window.scipaper.undoLastImport(article.id)
      await onApplied(nextState, '已撤销最近一次导入')
    } catch (error) {
      onError(error instanceof Error ? error.message : '撤销失败')
    } finally {
      setApplying(false)
    }
  }

  async function reformatWithAi() {
    if (!text.trim() || reformatting) return
    setReformatting(true)
    try {
      const result = await window.scipaper.reformatImportText({
        text,
        mode,
        articleLanguage: article?.language,
      })
      if (result.text) setText(result.text)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'AI 整理失败')
    } finally {
      setReformatting(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" role="presentation">
      <div className="modal-dialog modal-dialog--wide">
        <div className="modal-header">
          <div>
            <p className="eyebrow">AI Import Assistant</p>
            <h2>导入正文或审稿意见</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">关闭</button>
        </div>

        {!article ? (
          <section className="empty-panel">
            <h3>请先选择一篇文章</h3>
            <p>导入助手需要知道正文或审稿意见要写入哪篇文章。</p>
          </section>
        ) : (
          <div className="panel-stack">
            <section className="panel-card">
              <div className="form-grid">
                <label className="field">
                  <span>导入类型</span>
                  <select value={mode} onChange={(event) => setMode(event.target.value as ImportMode)}>
                    <option value="manuscript">{MODE_LABELS.manuscript}</option>
                    <option value="review">{MODE_LABELS.review}</option>
                  </select>
                </label>
                {mode === 'manuscript' ? (
                  <label className="field">
                    <span>写入方式</span>
                    <select value={writeMode} onChange={(event) => setWriteMode(event.target.value as WriteMode)}>
                      <option value="append">追加到对应章节</option>
                      <option value="replace">替换对应章节文字</option>
                    </select>
                  </label>
                ) : (
                  <label className="field">
                    <span>写入位置</span>
                    <select value={targetRoundId} onChange={(event) => setTargetRoundId(event.target.value)}>
                      <option value="__new__">新建审稿轮次</option>
                      {article.reviewRounds.map((round) => (
                        <option key={round.id} value={round.id}>
                          Round {round.roundNumber} · {round.journalName || article.targetJournal || '未填写期刊'}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center', marginTop: 'var(--sp-3)' }}>
                <button className="ghost-button" onClick={chooseFile} type="button">选择 .txt/.md/.docx/.pdf 文件</button>
                <button className="ghost-button" onClick={reformatWithAi} type="button" disabled={!text.trim() || reformatting}>
                  {reformatting ? 'AI 整理中...' : 'AI 重排版/清理'}
                </button>
                {sourceName && <span className="muted-text">{sourceName}</span>}
              </div>
              <label className="field" style={{ marginTop: 'var(--sp-3)' }}>
                <span>或直接粘贴文本</span>
                <textarea
                  rows={10}
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value)
                    setSourceName('')
                  }}
                  placeholder={mode === 'manuscript' ? '粘贴带有 Abstract / Introduction / Results 等标题的手稿正文...' : '粘贴 decision letter 或 reviewer comments...'}
                />
              </label>
            </section>

            <section className="panel-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Preview</p>
                  <h3>写入预览</h3>
                </div>
                <button className="primary-button" disabled={disabled} onClick={applyImport} type="button">
                  {applying ? '导入中...' : '确认导入'}
                </button>
                <button className="ghost-button" disabled={!article || applying} onClick={undoLastImport} type="button">
                  撤销最近导入
                </button>
              </div>

              {!text.trim() ? (
                <p className="empty-text">选择文件或粘贴文本后会在这里预览。</p>
              ) : mode === 'manuscript' ? (
                manuscriptSections.length > 0 ? (
                  <div className="plain-list">
                    {manuscriptSections.map((section) => (
                      <div key={section.sectionType} className="revision-item">
                        <strong>{section.title}</strong>
                        <p>{section.content.slice(0, 220)}{section.content.length > 220 ? '...' : ''}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-text">没有识别到标准章节标题。请保留 Abstract / Introduction / Methods / Results / Discussion 等标题。</p>
                )
              ) : reviewGroups.length > 0 ? (
                <div className="plain-list">
                  {reviewGroups.map((group) => (
                    <div key={group.reviewerId} className="revision-item">
                      <strong>{group.reviewerId} · {group.comments.length} 条意见</strong>
                      <p>{group.comments[0]?.originalText.slice(0, 220)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-text">没有识别到审稿意见。请保留 Reviewer 1 / Reviewer 2 或 comment 编号。</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

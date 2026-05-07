import { useEffect, useMemo, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'
import type { AppState, Article, ReviewCommentType, SectionType } from '../types'
import { localIsoDate } from '../utils/dateUtils'
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

const SECTION_OPTIONS: Array<{ value: SectionType; label: string }> = [
  { value: 'Title', label: '标题' },
  { value: 'Abstract', label: '摘要' },
  { value: 'Introduction', label: '引言' },
  { value: 'MaterialsAndMethods', label: '材料与方法' },
  { value: 'Results', label: '结果' },
  { value: 'Discussion', label: '讨论' },
  { value: 'References', label: '参考文献' },
]

type EditableManuscriptSection = {
  id: string
  sectionType: SectionType
  title: string
  content: string
  enabled: boolean
}

type EditableReviewComment = {
  id: string
  originalText: string
  type: ReviewCommentType
  suggestedSection: string
  enabled: boolean
}

type EditableReviewGroup = {
  id: string
  reviewerId: string
  comments: EditableReviewComment[]
}

export function ImportAssistantModal(props: ImportAssistantModalProps): JSX.Element | null {
  const { open, article, busy, onClose, onApplied, onError, defaultMode = 'manuscript' } = props
  const [mode, setMode] = useState<ImportMode>('manuscript')
  const [writeMode, setWriteMode] = useState<WriteMode>('append')
  const [targetRoundId, setTargetRoundId] = useState('__new__')
  const [text, setText] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [reviewMeta, setReviewMeta] = useState({
    submittedAt: localIsoDate(),
    journalName: '',
    manuscriptNumber: '',
    reviewReceivedAt: localIsoDate(),
  })
  const [applying, setApplying] = useState(false)
  const [reformatting, setReformatting] = useState(false)
  const [editableSections, setEditableSections] = useState<EditableManuscriptSection[]>([])
  const [editableReviewGroups, setEditableReviewGroups] = useState<EditableReviewGroup[]>([])

  const manuscriptSections = useMemo(() => parseManuscriptDraft(text), [text])
  const reviewGroups = useMemo(() => parseReviewLetter(text), [text])

  useEffect(() => {
    if (!open) return
    setMode(defaultMode)
    setReviewMeta({
      submittedAt: localIsoDate(),
      journalName: article?.targetJournal ?? '',
      manuscriptNumber: '',
      reviewReceivedAt: localIsoDate(),
    })
  }, [open, defaultMode, article?.targetJournal])

  useEffect(() => {
    setEditableSections(
      manuscriptSections.map((section, index) => ({
        id: `${section.sectionType}-${index}`,
        sectionType: section.sectionType,
        title: section.title,
        content: section.content,
        enabled: true,
      })),
    )
  }, [manuscriptSections])

  useEffect(() => {
    setEditableReviewGroups(
      reviewGroups.map((group, groupIndex) => ({
        id: `${group.reviewerId}-${groupIndex}`,
        reviewerId: group.reviewerId,
        comments: group.comments.map((comment, commentIndex) => ({
          id: `${group.reviewerId}-${groupIndex}-${commentIndex}`,
          originalText: comment.originalText,
          type: comment.type,
          suggestedSection: comment.suggestedSection,
          enabled: true,
        })),
      })),
    )
  }, [reviewGroups])

  if (!open) return null

  const enabledSections = editableSections.filter((section) => section.enabled && section.content.trim())
  const enabledReviewGroups = editableReviewGroups
    .map((group) => ({
      reviewerId: group.reviewerId.trim() || 'Reviewer',
      comments: group.comments
        .filter((comment) => comment.enabled && comment.originalText.trim())
        .map((comment) => ({
          originalText: comment.originalText.trim(),
          type: comment.type,
          suggestedSection: comment.suggestedSection.trim(),
        })),
    }))
    .filter((group) => group.comments.length > 0)
  const hasPreview = mode === 'manuscript' ? enabledSections.length > 0 : enabledReviewGroups.length > 0
  const disabled = busy || applying || !article || !hasPreview

  function addManualSection() {
    setEditableSections((prev) => [
      ...prev,
      {
        id: `manual-section-${Date.now()}`,
        sectionType: 'Introduction',
        title: 'Manual section',
        content: '',
        enabled: true,
      },
    ])
  }

  function addManualReviewerGroup() {
    const nextIndex = editableReviewGroups.length + 1
    setEditableReviewGroups((prev) => [
      ...prev,
      {
        id: `manual-reviewer-${Date.now()}`,
        reviewerId: `Reviewer ${nextIndex}`,
        comments: [
          {
            id: `manual-comment-${Date.now()}`,
            originalText: '',
            type: 'Major',
            suggestedSection: '',
            enabled: true,
          },
        ],
      },
    ])
  }

  function addManualReviewComment(groupId: string) {
    setEditableReviewGroups((prev) => prev.map((group) => (
      group.id === groupId
        ? {
            ...group,
            comments: [
              ...group.comments,
              {
                id: `manual-comment-${Date.now()}`,
                originalText: '',
                type: 'Major',
                suggestedSection: '',
                enabled: true,
              },
            ],
          }
        : group
    )))
  }

  function removeSection(sectionId: string) {
    setEditableSections((prev) => prev.filter((section) => section.id !== sectionId))
  }

  function removeReviewerGroup(groupId: string) {
    setEditableReviewGroups((prev) => prev.filter((group) => group.id !== groupId))
  }

  function removeReviewComment(groupId: string, commentId: string) {
    setEditableReviewGroups((prev) => prev
      .map((group) => (
        group.id === groupId
          ? { ...group, comments: group.comments.filter((comment) => comment.id !== commentId) }
          : group
      ))
      .filter((group) => group.comments.length > 0))
  }

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
          enabledSections.map((section) => ({
            sectionType: section.sectionType,
            content: section.content.trim(),
            description: sourceName ? `Imported manuscript draft: ${sourceName}` : 'Imported manuscript draft',
            sourceName,
          })),
          writeMode,
        )
        onApplied(nextState, writeMode === 'replace' ? '手稿正文已导入并替换章节' : '手稿正文已追加导入')
      } else {
        const nextState = await window.scipaper.importReviewComments(article.id, {
          roundId: targetRoundId === '__new__' ? undefined : targetRoundId,
          submittedAt: reviewMeta.submittedAt,
          journalName: reviewMeta.journalName.trim() || article.targetJournal,
          manuscriptNumber: reviewMeta.manuscriptNumber,
          reviewReceivedAt: reviewMeta.reviewReceivedAt,
          sourceName,
          groups: enabledReviewGroups,
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
                      <option value="__new__">新建审稿轮次（推荐）</option>
                      {article.reviewRounds.map((round) => (
                        <option key={round.id} value={round.id}>
                          追加到 Round {round.roundNumber} · {round.journalName || article.targetJournal || '未填写期刊'} · {round.comments.length} 条已有意见
                        </option>
                      ))}
                    </select>
                    <small className="muted-text">
                      新建会生成一个独立轮次；选择已有 Round 会把识别结果追加进去。
                    </small>
                  </label>
                )}
              </div>
              {mode === 'review' ? (
                <div className="form-grid" style={{ marginTop: 'var(--sp-3)' }}>
                  <label className="field">
                    <span>期刊</span>
                    <input
                      value={reviewMeta.journalName}
                      onChange={(event) => setReviewMeta((prev) => ({ ...prev, journalName: event.target.value }))}
                      placeholder={article.targetJournal || 'Journal name'}
                    />
                  </label>
                  <label className="field">
                    <span>稿件号</span>
                    <input
                      value={reviewMeta.manuscriptNumber}
                      onChange={(event) => setReviewMeta((prev) => ({ ...prev, manuscriptNumber: event.target.value }))}
                      placeholder="Manuscript number"
                    />
                  </label>
                  <label className="field">
                    <span>投稿日期</span>
                    <input
                      type="date"
                      value={reviewMeta.submittedAt}
                      onChange={(event) => setReviewMeta((prev) => ({ ...prev, submittedAt: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>收到审稿日期</span>
                    <input
                      type="date"
                      value={reviewMeta.reviewReceivedAt}
                      onChange={(event) => setReviewMeta((prev) => ({ ...prev, reviewReceivedAt: event.target.value }))}
                    />
                  </label>
                </div>
              ) : null}
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
                {mode === 'manuscript' ? (
                  <button className="ghost-button" type="button" onClick={addManualSection}>
                    手动补章节
                  </button>
                ) : (
                  <button className="ghost-button" type="button" onClick={addManualReviewerGroup}>
                    手动补审稿人
                  </button>
                )}
                <button className="ghost-button" disabled={!article || applying} onClick={undoLastImport} type="button">
                  撤销最近导入
                </button>
              </div>

              {!text.trim() && editableSections.length === 0 && editableReviewGroups.length === 0 ? (
                <p className="empty-text">选择文件或粘贴文本后会在这里预览。</p>
              ) : mode === 'manuscript' ? (
                editableSections.length > 0 ? (
                  <div className="plain-list">
                    {editableSections.map((section, index) => (
                      <div key={section.id} className="revision-item">
                        <div className="form-grid">
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={section.enabled}
                              onChange={(event) => setEditableSections((prev) => prev.map((item) => (
                                item.id === section.id ? { ...item, enabled: event.target.checked } : item
                              )))}
                            />
                            <span>导入第 {index + 1} 段</span>
                          </label>
                          <label className="field">
                            <span>目标章节</span>
                            <select
                              value={section.sectionType}
                              onChange={(event) => setEditableSections((prev) => prev.map((item) => (
                                item.id === section.id ? { ...item, sectionType: event.target.value as SectionType } : item
                              )))}
                            >
                              {SECTION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <button className="ghost-button danger" type="button" onClick={() => removeSection(section.id)}>
                            移出本次导入
                          </button>
                        </div>
                        <label className="field" style={{ marginTop: 'var(--sp-2)' }}>
                          <span>内容</span>
                          <textarea
                            rows={5}
                            value={section.content}
                            onChange={(event) => setEditableSections((prev) => prev.map((item) => (
                              item.id === section.id ? { ...item, content: event.target.value } : item
                            )))}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-text">没有识别到标准章节标题。请保留 Abstract / Introduction / Methods / Results / Discussion 等标题。</p>
                )
              ) : editableReviewGroups.length > 0 ? (
                <div className="plain-list">
                  {editableReviewGroups.map((group, groupIndex) => (
                    <div key={group.id} className="revision-item">
                      <label className="field">
                        <span>审稿人</span>
                        <input
                          value={group.reviewerId}
                          onChange={(event) => setEditableReviewGroups((prev) => prev.map((item) => (
                            item.id === group.id ? { ...item, reviewerId: event.target.value } : item
                          )))}
                        />
                      </label>
                      <button className="ghost-button" type="button" onClick={() => addManualReviewComment(group.id)}>
                        给该审稿人补一条意见
                      </button>
                      <button className="ghost-button danger" type="button" onClick={() => removeReviewerGroup(group.id)}>
                        移出该审稿人
                      </button>
                      <div className="plain-list" style={{ marginTop: 'var(--sp-2)' }}>
                        {group.comments.map((comment, commentIndex) => (
                          <div key={comment.id} className="revision-item">
                            <div className="form-grid">
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={comment.enabled}
                                  onChange={(event) => setEditableReviewGroups((prev) => prev.map((item) => (
                                    item.id === group.id
                                      ? {
                                          ...item,
                                          comments: item.comments.map((entry) => (
                                            entry.id === comment.id ? { ...entry, enabled: event.target.checked } : entry
                                          )),
                                        }
                                      : item
                                  )))}
                                />
                                <span>导入意见 {groupIndex + 1}.{commentIndex + 1}</span>
                              </label>
                              <label className="field">
                                <span>类型</span>
                                <select
                                  value={comment.type}
                                  onChange={(event) => setEditableReviewGroups((prev) => prev.map((item) => (
                                    item.id === group.id
                                      ? {
                                          ...item,
                                          comments: item.comments.map((entry) => (
                                            entry.id === comment.id ? { ...entry, type: event.target.value as ReviewCommentType } : entry
                                          )),
                                        }
                                      : item
                                  )))}
                                >
                                  <option value="Major">Major</option>
                                  <option value="Minor">Minor</option>
                                </select>
                              </label>
                              <button className="ghost-button danger" type="button" onClick={() => removeReviewComment(group.id, comment.id)}>
                                移出该意见
                              </button>
                            </div>
                            <label className="field" style={{ marginTop: 'var(--sp-2)' }}>
                              <span>建议关联章节</span>
                              <input
                                value={comment.suggestedSection}
                                onChange={(event) => setEditableReviewGroups((prev) => prev.map((item) => (
                                  item.id === group.id
                                    ? {
                                        ...item,
                                        comments: item.comments.map((entry) => (
                                          entry.id === comment.id ? { ...entry, suggestedSection: event.target.value } : entry
                                        )),
                                      }
                                    : item
                                )))}
                                placeholder="例如 Results / Discussion / References"
                              />
                            </label>
                            <label className="field" style={{ marginTop: 'var(--sp-2)' }}>
                              <span>意见内容</span>
                              <textarea
                                rows={4}
                                value={comment.originalText}
                                onChange={(event) => setEditableReviewGroups((prev) => prev.map((item) => (
                                  item.id === group.id
                                    ? {
                                        ...item,
                                        comments: item.comments.map((entry) => (
                                          entry.id === comment.id ? { ...entry, originalText: event.target.value } : entry
                                        )),
                                      }
                                    : item
                                )))}
                              />
                            </label>
                          </div>
                        ))}
                      </div>
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

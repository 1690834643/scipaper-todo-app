import { useState } from 'react'
import type { Article, CommentStatus, Revision, ReviewComment, ReviewCommentType, ReviewRound } from '../types'
import { localIsoDate } from '../utils/dateUtils'

interface ReviewPanelProps {
  article: Article
  onAddRound: (payload: { submittedAt: string; journalName: string; manuscriptNumber: string }) => Promise<void>
  onUpdateRound: (
    roundId: string,
    patch: { submittedAt?: string; journalName?: string; manuscriptNumber?: string; reviewReceivedAt?: string },
  ) => Promise<void>
  onAddComment: (
    roundId: string,
    payload: { reviewerId: string; originalText: string; type: ReviewCommentType; suggestedSection: string },
  ) => Promise<void>
  onUpdateStatus: (roundId: string, commentId: string, status: CommentStatus) => Promise<void>
  onUpdateComment: (
    roundId: string,
    commentId: string,
    patch: { reviewerId?: string; originalText?: string; type?: ReviewCommentType; suggestedSection?: string; status?: CommentStatus },
  ) => Promise<void>
  onDeleteComment: (roundId: string, commentId: string) => Promise<void>
  onDeleteRound: (roundId: string) => Promise<void>
  onAddRevision: (roundId: string, commentId: string, payload: { description: string; responseText: string; markCompleted?: boolean }) => Promise<void>
  onUpdateRevision: (
    roundId: string,
    commentId: string,
    revisionId: string,
    patch: { description?: string; responseText?: string; modifiedBlockIds?: string[]; isVerified?: boolean },
  ) => Promise<void>
  onDeleteRevision: (roundId: string, commentId: string, revisionId: string) => Promise<void>
  onOpenImport: () => void
}

function RoundComposer({
  onSubmit,
}: {
  onSubmit: (payload: { submittedAt: string; journalName: string; manuscriptNumber: string }) => Promise<void>
}) {
  const [draft, setDraft] = useState({
    submittedAt: localIsoDate(),
    journalName: '',
    manuscriptNumber: '',
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!draft.journalName.trim() || saving) return
    setSaving(true)
    try {
      await onSubmit(draft)
      setDraft({ submittedAt: localIsoDate(), journalName: '', manuscriptNumber: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Review Workflow</p>
          <h3>新建投稿轮次</h3>
        </div>
        <button className="primary-button" onClick={submit} type="button" disabled={!draft.journalName.trim() || saving}>
          {saving ? '添加中…' : '添加轮次'}
        </button>
      </div>
      <div className="form-grid review-grid">
        <label className="field">
          <span>投稿日期</span>
          <input type="date" value={draft.submittedAt} onChange={(event) => setDraft({ ...draft, submittedAt: event.target.value })} />
        </label>
        <label className="field">
          <span>期刊名</span>
          <input value={draft.journalName} onChange={(event) => setDraft({ ...draft, journalName: event.target.value })} />
        </label>
        <label className="field">
          <span>稿件号</span>
          <input value={draft.manuscriptNumber} onChange={(event) => setDraft({ ...draft, manuscriptNumber: event.target.value })} />
        </label>
      </div>
    </section>
  )
}

function CommentComposer({
  round,
  onSubmit,
}: {
  round: ReviewRound
  onSubmit: (
    roundId: string,
    payload: { reviewerId: string; originalText: string; type: ReviewCommentType; suggestedSection: string },
  ) => Promise<void>
}) {
  const [draft, setDraft] = useState({
    reviewerId: '',
    originalText: '',
    type: 'Major' as ReviewCommentType,
    suggestedSection: '',
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!draft.originalText.trim() || saving) return
    setSaving(true)
    try {
      await onSubmit(round.id, draft)
      setDraft({ reviewerId: '', originalText: '', type: 'Major', suggestedSection: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Round {round.roundNumber}</p>
          <h3>录入审稿意见</h3>
        </div>
        <button className="primary-button" onClick={submit} type="button" disabled={!draft.originalText.trim() || saving}>
          {saving ? '保存中…' : '保存意见'}
        </button>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>审稿人编号</span>
          <input value={draft.reviewerId} onChange={(event) => setDraft({ ...draft, reviewerId: event.target.value })} placeholder="Reviewer 1" />
        </label>
        <label className="field">
          <span>建议修改章节</span>
          <input value={draft.suggestedSection} onChange={(event) => setDraft({ ...draft, suggestedSection: event.target.value })} placeholder="Results" />
        </label>
        <label className="field">
          <span>问题等级</span>
          <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ReviewCommentType })}>
            <option value="Major">Major</option>
            <option value="Minor">Minor</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>原始审稿意见</span>
        <textarea rows={4} value={draft.originalText} onChange={(event) => setDraft({ ...draft, originalText: event.target.value })} />
      </label>
    </section>
  )
}

function RevisionComposer({
  roundId,
  comment,
  onSubmit,
}: {
  roundId: string
  comment: ReviewComment
  onSubmit: (roundId: string, commentId: string, payload: { description: string; responseText: string; markCompleted?: boolean }) => Promise<void>
}) {
  const [draft, setDraft] = useState({
    description: '',
    responseText: '',
    markCompleted: true,
  })
  const [saving, setSaving] = useState(false)

  async function submit() {
    if ((!draft.description.trim() && !draft.responseText.trim()) || saving) return
    setSaving(true)
    try {
      await onSubmit(roundId, comment.id, draft)
      setDraft({ description: '', responseText: '', markCompleted: true })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="revision-composer">
      <label className="field">
        <span>修改描述</span>
        <textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </label>
      <label className="field">
        <span>给审稿人的回复</span>
        <textarea rows={3} value={draft.responseText} onChange={(event) => setDraft({ ...draft, responseText: event.target.value })} />
      </label>
      <label className="checkbox-row">
        <input
          checked={draft.markCompleted}
          onChange={(event) => setDraft({ ...draft, markCompleted: event.target.checked })}
          type="checkbox"
        />
        <span>提交后直接标记为已完成</span>
      </label>
      <button
        className="ghost-button"
        onClick={submit}
        type="button"
        disabled={(!draft.description.trim() && !draft.responseText.trim()) || saving}
      >
        {saving ? '记录中…' : '记录修改'}
      </button>
    </div>
  )
}

export function ReviewPanel({
  article,
  onAddRound,
  onUpdateRound,
  onAddComment,
  onUpdateStatus,
  onUpdateComment,
  onDeleteComment,
  onDeleteRound,
  onAddRevision,
  onUpdateRevision,
  onDeleteRevision,
  onOpenImport,
}: ReviewPanelProps) {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null)
  const [editingRevisionId, setEditingRevisionId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({
    reviewerId: '',
    originalText: '',
    type: 'Major' as ReviewCommentType,
    suggestedSection: '',
    status: 'Pending' as CommentStatus,
  })
  const [roundDraft, setRoundDraft] = useState({
    submittedAt: '',
    journalName: '',
    manuscriptNumber: '',
    reviewReceivedAt: '',
  })
  const [revisionDraft, setRevisionDraft] = useState({
    description: '',
    responseText: '',
    isVerified: false,
  })

  function startEdit(comment: ReviewComment) {
    setEditingCommentId(comment.id)
    setEditDraft({
      reviewerId: comment.reviewerId,
      originalText: comment.originalText,
      type: comment.type,
      suggestedSection: comment.suggestedSection,
      status: comment.status,
    })
  }

  function startRoundEdit(round: ReviewRound) {
    setEditingRoundId(round.id)
    setRoundDraft({
      submittedAt: round.submittedAt,
      journalName: round.journalName,
      manuscriptNumber: round.manuscriptNumber,
      reviewReceivedAt: round.reviewReceivedAt || '',
    })
  }

  function startRevisionEdit(revision: Revision) {
    setEditingRevisionId(revision.id)
    setRevisionDraft({
      description: revision.description,
      responseText: revision.responseText,
      isVerified: revision.isVerified,
    })
  }

  function groupCommentsByReviewer(comments: ReviewComment[]) {
    const groups = new Map<string, ReviewComment[]>()
    for (const comment of comments) {
      const reviewerId = comment.reviewerId || 'Reviewer'
      groups.set(reviewerId, [...(groups.get(reviewerId) || []), comment])
    }
    return Array.from(groups.entries()).map(([reviewerId, items]) => ({ reviewerId, comments: items }))
  }

  return (
    <div className="panel-stack">
      <section className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Review Import</p>
            <h3>审稿意见入口</h3>
          </div>
          <button className="primary-button" type="button" onClick={onOpenImport}>
            导入审稿意见
          </button>
        </div>
        <p className="muted-text">支持粘贴或选择 .txt/.md/.docx/.pdf 文本型文件，也可以先用 AI 重排版/清理后再确认写入。</p>
      </section>

      <RoundComposer onSubmit={onAddRound} />

      {article.reviewRounds.length === 0 ? (
        <section className="empty-panel">
          <h3>还没有投稿记录</h3>
          <p>先创建一轮投稿，再开始录入审稿意见和修改记录。</p>
        </section>
      ) : null}

      {article.reviewRounds.map((round) => (
        <section key={round.id} className="review-round-card">
          <div className="timeline-head">
            <div>
              <p className="eyebrow">Round {round.roundNumber}</p>
              <h3>{round.journalName}</h3>
            </div>
            <div className="timeline-meta">
              <span>投稿: {round.submittedAt}</span>
              <span>稿件号: {round.manuscriptNumber || '未填写'}</span>
              <span>收到意见: {round.reviewReceivedAt || '未收到'}</span>
              <button className="ghost-button" type="button" onClick={() => startRoundEdit(round)}>
                修改轮次
              </button>
              <button
                className="ghost-button danger"
                type="button"
                onClick={() => {
                  if (confirm(`确定删除 Round ${round.roundNumber} 及其全部审稿意见？`)) onDeleteRound(round.id)
                }}
              >
                删除轮次
              </button>
            </div>
          </div>

          {editingRoundId === round.id ? (
            <div className="revision-composer">
              <div className="form-grid review-grid">
                <label className="field">
                  <span>投稿日期</span>
                  <input type="date" value={roundDraft.submittedAt} onChange={(event) => setRoundDraft({ ...roundDraft, submittedAt: event.target.value })} />
                </label>
                <label className="field">
                  <span>期刊名</span>
                  <input value={roundDraft.journalName} onChange={(event) => setRoundDraft({ ...roundDraft, journalName: event.target.value })} />
                </label>
                <label className="field">
                  <span>稿件号</span>
                  <input value={roundDraft.manuscriptNumber} onChange={(event) => setRoundDraft({ ...roundDraft, manuscriptNumber: event.target.value })} />
                </label>
                <label className="field">
                  <span>收到意见日期</span>
                  <input type="date" value={roundDraft.reviewReceivedAt} onChange={(event) => setRoundDraft({ ...roundDraft, reviewReceivedAt: event.target.value })} />
                </label>
              </div>
              <div className="header-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={async () => {
                    await onUpdateRound(round.id, roundDraft)
                    setEditingRoundId(null)
                  }}
                >
                  保存轮次
                </button>
                <button className="ghost-button" type="button" onClick={() => setEditingRoundId(null)}>
                  取消
                </button>
              </div>
            </div>
          ) : null}

          <CommentComposer round={round} onSubmit={onAddComment} />

          <div className="comment-list">
            {groupCommentsByReviewer(round.comments).map((group) => {
              const pendingCount = group.comments.filter((comment) => comment.status !== 'Completed').length
              return (
                <section key={group.reviewerId} className="panel-card">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Reviewer</p>
                      <h3>{group.reviewerId}</h3>
                      <p>{group.comments.length} 条意见 · {pendingCount} 条未完成</p>
                    </div>
                  </div>
                  {group.comments.map((comment, index) => (
                    <article key={comment.id} className="comment-card">
                      <div className="comment-head">
                        <div>
                          <strong>Comment {index + 1}</strong>
                          <p>
                            {comment.type} · 建议修改 {comment.suggestedSection || '未指定'}
                          </p>
                        </div>
                        <select
                          value={comment.status}
                          onChange={(event) => onUpdateStatus(round.id, comment.id, event.target.value as CommentStatus)}
                        >
                          <option value="Pending">待处理</option>
                          <option value="InProgress">修改中</option>
                          <option value="Completed">已完成</option>
                          <option value="Disagreed">不同意</option>
                        </select>
                      </div>

                      <p className="comment-body">{comment.originalText}</p>

                      {editingCommentId === comment.id ? (
                        <div className="revision-composer">
                          <div className="form-grid">
                            <label className="field">
                              <span>审稿人</span>
                              <input value={editDraft.reviewerId} onChange={(event) => setEditDraft({ ...editDraft, reviewerId: event.target.value })} />
                            </label>
                            <label className="field">
                              <span>建议章节</span>
                              <input value={editDraft.suggestedSection} onChange={(event) => setEditDraft({ ...editDraft, suggestedSection: event.target.value })} />
                            </label>
                            <label className="field">
                              <span>等级</span>
                              <select value={editDraft.type} onChange={(event) => setEditDraft({ ...editDraft, type: event.target.value as ReviewCommentType })}>
                                <option value="Major">Major</option>
                                <option value="Minor">Minor</option>
                              </select>
                            </label>
                            <label className="field">
                              <span>状态</span>
                              <select value={editDraft.status} onChange={(event) => setEditDraft({ ...editDraft, status: event.target.value as CommentStatus })}>
                                <option value="Pending">待处理</option>
                                <option value="InProgress">修改中</option>
                                <option value="Completed">已完成</option>
                                <option value="Disagreed">不同意</option>
                              </select>
                            </label>
                          </div>
                          <label className="field">
                            <span>原始审稿意见</span>
                            <textarea rows={4} value={editDraft.originalText} onChange={(event) => setEditDraft({ ...editDraft, originalText: event.target.value })} />
                          </label>
                          <div className="header-actions">
                            <button
                              className="primary-button"
                              type="button"
                              onClick={async () => {
                                await onUpdateComment(round.id, comment.id, editDraft)
                                setEditingCommentId(null)
                              }}
                            >
                              保存意见
                            </button>
                            <button className="ghost-button" type="button" onClick={() => setEditingCommentId(null)}>
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="header-actions">
                          <button className="ghost-button" type="button" onClick={() => startEdit(comment)}>
                            修改意见
                          </button>
                          <button
                            className="ghost-button danger"
                            type="button"
                            onClick={() => {
                              if (confirm('确定删除这条审稿意见？相关修改记录也会一起删除。')) onDeleteComment(round.id, comment.id)
                            }}
                          >
                            删除意见
                          </button>
                        </div>
                      )}

                      <div className="revision-list">
                        {comment.revisions.map((revision) => (
                          <div key={revision.id} className="revision-item">
                            {editingRevisionId === revision.id ? (
                              <div className="revision-composer">
                                <label className="field">
                                  <span>修改描述</span>
                                  <textarea rows={3} value={revisionDraft.description} onChange={(event) => setRevisionDraft({ ...revisionDraft, description: event.target.value })} />
                                </label>
                                <label className="field">
                                  <span>给审稿人的回复</span>
                                  <textarea rows={3} value={revisionDraft.responseText} onChange={(event) => setRevisionDraft({ ...revisionDraft, responseText: event.target.value })} />
                                </label>
                                <label className="checkbox-row">
                                  <input
                                    checked={revisionDraft.isVerified}
                                    onChange={(event) => setRevisionDraft({ ...revisionDraft, isVerified: event.target.checked })}
                                    type="checkbox"
                                  />
                                  <span>已核对</span>
                                </label>
                                <div className="header-actions">
                                  <button
                                    className="primary-button"
                                    type="button"
                                    onClick={async () => {
                                      await onUpdateRevision(round.id, comment.id, revision.id, revisionDraft)
                                      setEditingRevisionId(null)
                                    }}
                                  >
                                    保存回复
                                  </button>
                                  <button className="ghost-button" type="button" onClick={() => setEditingRevisionId(null)}>
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <strong>{revision.description || '未填写修改描述'}</strong>
                                <p>{revision.responseText || '未填写回复文本'}</p>
                                <span>{new Date(revision.completedAt).toLocaleString('zh-CN')}{revision.isVerified ? ' · 已核对' : ''}</span>
                                <div className="header-actions">
                                  <button className="ghost-button" type="button" onClick={() => startRevisionEdit(revision)}>
                                    修改回复
                                  </button>
                                  <button
                                    className="ghost-button danger"
                                    type="button"
                                    onClick={() => {
                                      if (confirm('确定删除这条修回记录？')) onDeleteRevision(round.id, comment.id, revision.id)
                                    }}
                                  >
                                    删除回复
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                      <RevisionComposer roundId={round.id} comment={comment} onSubmit={onAddRevision} />
                    </article>
                  ))}
                </section>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

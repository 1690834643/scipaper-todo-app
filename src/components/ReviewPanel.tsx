import { useState } from 'react'
import type { Article, CommentStatus, ReviewComment, ReviewCommentType, ReviewRound } from '../types'
import { localIsoDate } from '../utils/dateUtils'

interface ReviewPanelProps {
  article: Article
  onAddRound: (payload: { submittedAt: string; journalName: string; manuscriptNumber: string }) => Promise<void>
  onAddComment: (
    roundId: string,
    payload: { reviewerId: string; originalText: string; type: ReviewCommentType; suggestedSection: string },
  ) => Promise<void>
  onUpdateStatus: (roundId: string, commentId: string, status: CommentStatus) => Promise<void>
  onAddRevision: (roundId: string, commentId: string, payload: { description: string; responseText: string; markCompleted?: boolean }) => Promise<void>
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

  return (
    <section className="panel-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Review Workflow</p>
          <h3>新建投稿轮次</h3>
        </div>
        <button className="primary-button" onClick={() => onSubmit(draft)} type="button">
          添加轮次
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

  return (
    <section className="panel-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Round {round.roundNumber}</p>
          <h3>录入审稿意见</h3>
        </div>
        <button className="primary-button" onClick={() => onSubmit(round.id, draft)} type="button">
          保存意见
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
      <button className="ghost-button" onClick={() => onSubmit(roundId, comment.id, draft)} type="button">
        记录修改
      </button>
    </div>
  )
}

export function ReviewPanel({ article, onAddRound, onAddComment, onUpdateStatus, onAddRevision }: ReviewPanelProps) {
  return (
    <div className="panel-stack">
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
            </div>
          </div>

          <CommentComposer round={round} onSubmit={onAddComment} />

          <div className="comment-list">
            {round.comments.map((comment) => (
              <article key={comment.id} className="comment-card">
                <div className="comment-head">
                  <div>
                    <strong>{comment.reviewerId}</strong>
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

                <div className="revision-list">
                  {comment.revisions.map((revision) => (
                    <div key={revision.id} className="revision-item">
                      <strong>{revision.description}</strong>
                      <p>{revision.responseText || '未填写回复文本'}</p>
                      <span>{new Date(revision.completedAt).toLocaleString('zh-CN')}</span>
                    </div>
                  ))}
                </div>

                <RevisionComposer roundId={round.id} comment={comment} onSubmit={onAddRevision} />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

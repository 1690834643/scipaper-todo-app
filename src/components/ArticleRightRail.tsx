// =============================================================================
// ArticleRightRail — design pack §① RightRail.
//
// Sits to the right of `.content-stage` on Section tabs. Three sections:
//   • 批注      — pending annotations on the active block (from focusBlock)
//   • 提交进度  — 4-step status track derived from article.status + reviewRounds
//   • 章节大纲  — H2 / H3 list parsed from each text block's HTML
//
// Pure presentational; data flows in via props from App. No new state model.
// =============================================================================

import { useMemo } from 'react'
import type { Article, ArticleStatus, BlockAnnotation, ContentBlock, Section } from '../types'

interface ArticleRightRailProps {
  article: Article
  section: Section | null
  /** The block currently focused in the writing surface. Used to resolve
   *  "open annotations on this block" — falls back to the section's first
   *  text block when the user is in preview mode (no focus). */
  focusBlock: ContentBlock | null
  /** Optional: clicking an annotation row tells the parent to scroll to it.
   *  When omitted, rows render as static. */
  onJumpAnnotation?: (annotation: BlockAnnotation) => void
  /** Optional: clicking an outline item tells the parent to scroll the
   *  matching heading into view. Receives the heading's plain-text label. */
  onJumpOutline?: (label: string) => void
}

interface ProgressStep {
  key: string
  label: string
  state: 'done' | 'active' | 'pending'
}

function deriveProgress(status: ArticleStatus, roundsDone: number): ProgressStep[] {
  // 4-step track: 初稿 → 投稿 → 审稿 → 修回完成. Status maps cleanly to one
  // active step, with everything before it done. Rejected = stalled at 审稿.
  const order: { key: string; label: string }[] = [
    { key: 'draft', label: '初稿撰写' },
    { key: 'submit', label: '投稿期刊' },
    { key: 'review', label: roundsDone > 1 ? `审稿 · 第 ${roundsDone} 轮` : '审稿意见' },
    { key: 'final', label: '修回完成' },
  ]
  let activeIdx = 0
  switch (status) {
    case 'Drafting':
      activeIdx = 0
      break
    case 'Submitted':
    case 'Resubmitted':
      activeIdx = 1
      break
    case 'UnderReview':
      activeIdx = 2
      break
    case 'Revision':
      activeIdx = 2
      break
    case 'Accepted':
    case 'Published':
      activeIdx = 3
      break
    case 'Rejected':
      // Stalled at review — show review as active (red dot via .is-stalled).
      activeIdx = 2
      break
  }
  return order.map((s, i) => ({
    ...s,
    state: i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending',
  }))
}

interface OutlineEntry {
  level: 2 | 3
  text: string
}

function parseOutline(blocks: ContentBlock[]): OutlineEntry[] {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return []
  const parser = new DOMParser()
  const out: OutlineEntry[] = []
  for (const block of blocks) {
    if (block.type !== 'Text' || !block.content) continue
    if (!/<h[23]\b/i.test(block.content)) continue
    const doc = parser.parseFromString(block.content, 'text/html')
    doc.querySelectorAll('h2, h3').forEach((node) => {
      const level = node.tagName === 'H2' ? 2 : 3
      const text = (node.textContent || '').trim()
      if (text) out.push({ level, text })
    })
  }
  return out
}

export function ArticleRightRail({
  article,
  section,
  focusBlock,
  onJumpAnnotation,
  onJumpOutline,
}: ArticleRightRailProps) {
  const annotations = useMemo<BlockAnnotation[]>(() => {
    // Prefer the focused block; fall back to the union of the section's text
    // blocks so the rail still has something to show in preview mode.
    if (focusBlock?.annotations && focusBlock.annotations.length > 0) {
      return focusBlock.annotations
    }
    if (!section) return []
    return section.contentBlocks
      .filter((b): b is ContentBlock => b.type === 'Text')
      .flatMap((b) => b.annotations || [])
  }, [focusBlock, section])

  const openAnnotations = annotations.filter((a) => a.status !== 'resolved')
  const totalAnnotations = annotations.length

  const progress = useMemo(
    () => deriveProgress(article.status, (article.reviewRounds || []).length),
    [article.status, article.reviewRounds],
  )

  const outline = useMemo<OutlineEntry[]>(() => {
    if (!section) return []
    const headings = parseOutline(section.contentBlocks)
    if (headings.length > 0) return headings
    // Fallback: list the text blocks' description fields so the user always
    // has *something* showing the structure of this section.
    return section.contentBlocks
      .filter((b): b is ContentBlock => b.type === 'Text')
      .map((b) => ({
        level: 2 as const,
        text: b.description?.trim() || '未命名段落',
      }))
  }, [section])

  return (
    <aside className="article-right-rail" aria-label="章节侧栏">
      <section className="rail-section">
        <header className="rail-head">
          <span className="rail-eyebrow">批注</span>
          <span className="rail-count">{openAnnotations.length} / {totalAnnotations}</span>
        </header>
        {totalAnnotations === 0 ? (
          <p className="rail-empty">还没有批注。在正文里选中一段话即可添加。</p>
        ) : (
          <ul className="rail-annotation-list">
            {annotations.slice(0, 6).map((ann) => (
              <li key={ann.id} className={`rail-annotation rail-annotation--${ann.status}`}>
                <button
                  type="button"
                  className="rail-annotation-btn"
                  onClick={() => onJumpAnnotation?.(ann)}
                  disabled={!onJumpAnnotation}
                  title={ann.comment}
                >
                  <span className="rail-annotation-author">
                    {ann.author === 'ai' ? 'AI' : '我'}
                  </span>
                  <span className="rail-annotation-anchor">"{ann.anchorText.slice(0, 18)}{ann.anchorText.length > 18 ? '…' : ''}"</span>
                  <span className="rail-annotation-comment">{ann.comment}</span>
                </button>
              </li>
            ))}
            {annotations.length > 6 ? (
              <li className="rail-annotation-more">+{annotations.length - 6} 条更多</li>
            ) : null}
          </ul>
        )}
      </section>

      <hr className="rail-divider" />

      <section className="rail-section">
        <header className="rail-head">
          <span className="rail-eyebrow">提交进度</span>
          <span className="rail-count">
            {(article.reviewRounds || []).length > 0
              ? `第 ${article.reviewRounds.length} 轮`
              : '未投稿'}
          </span>
        </header>
        <ol className="rail-progress-track">
          {progress.map((step) => (
            <li key={step.key} className={`rail-step rail-step--${step.state}`}>
              <span className="rail-step-dot" aria-hidden />
              <span className="rail-step-label">{step.label}</span>
            </li>
          ))}
        </ol>
      </section>

      <hr className="rail-divider" />

      <section className="rail-section">
        <header className="rail-head">
          <span className="rail-eyebrow">章节大纲</span>
          <span className="rail-count">{outline.length}</span>
        </header>
        {outline.length === 0 ? (
          <p className="rail-empty">这一节还没有内容。</p>
        ) : (
          <ul className="rail-outline">
            {outline.slice(0, 12).map((entry, idx) => (
              <li key={idx} className={`rail-outline-item rail-outline-item--h${entry.level}`}>
                <button
                  type="button"
                  className="rail-outline-btn"
                  onClick={() => onJumpOutline?.(entry.text)}
                  disabled={!onJumpOutline}
                  title={entry.text}
                >
                  <span className="rail-outline-num">{idx + 1}.</span>
                  <span className="rail-outline-text">{entry.text}</span>
                </button>
              </li>
            ))}
            {outline.length > 12 ? (
              <li className="rail-outline-more">+{outline.length - 12} 条更多</li>
            ) : null}
          </ul>
        )}
      </section>
    </aside>
  )
}

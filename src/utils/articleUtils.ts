import type { Article, ArticleStatus, Thesis, ThesisStatus } from '../types'
import { localIsoDate } from './dateUtils'

/* ---------- Word counts (single source of truth) ---------- */

export function countArticleWords(item: Article | Thesis): number {
  let total = 0
  for (const section of item.sections) {
    for (const block of section.contentBlocks) {
      if (block.type === 'Text' && block.content) {
        total += block.content.replace(/\s+/g, '').length
      }
    }
  }
  return total
}

/* ---------- Relative time (single source of truth) ---------- */

export function relativeTime(iso: string | undefined | null): string {
  if (!iso) return '从未编辑'
  const ts = new Date(iso).getTime()
  if (Number.isNaN(ts)) return '从未编辑'
  const diff = Math.max(0, Date.now() - ts)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec} 秒前`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  return localIsoDate(new Date(iso))
}

/* ---------- Status label + data-status mapping ---------- */

export const ARTICLE_STATUS_LABEL_ZH: Record<ArticleStatus, string> = {
  Drafting: '撰写中',
  Submitted: '已投稿',
  UnderReview: '审稿中',
  Revision: '返修中',
  Resubmitted: '已修回',
  Accepted: '已接收',
  Rejected: '已拒稿',
  Published: '已发表',
}

export const THESIS_STATUS_LABEL_ZH: Record<ThesisStatus, string> = {
  Proposal: '开题',
  InProgress: '撰写中',
  DefenseReady: '可答辩',
  Defended: '已答辩',
  Revised: '修改中',
  Final: '终版',
}

export type DataStatus = 'draft' | 'review' | 'published'

export function articleStatusToDataStatus(status: ArticleStatus): DataStatus {
  switch (status) {
    case 'Drafting':
    case 'Rejected':
      return 'draft'
    case 'Submitted':
    case 'UnderReview':
    case 'Revision':
    case 'Resubmitted':
      return 'review'
    case 'Accepted':
    case 'Published':
      return 'published'
  }
}

export function thesisStatusToDataStatus(status: ThesisStatus): DataStatus {
  switch (status) {
    case 'Proposal':
    case 'InProgress':
      return 'draft'
    case 'DefenseReady':
    case 'Defended':
    case 'Revised':
      return 'review'
    case 'Final':
      return 'published'
  }
}

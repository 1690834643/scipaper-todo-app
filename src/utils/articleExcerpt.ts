import type { Article } from '../types'
import { stripHtml } from './htmlContent'

export function articleExcerpt(article: Article): string {
  for (const sec of article.sections) {
    for (const blk of sec.contentBlocks) {
      if (blk.type === 'Text' && blk.content && blk.content.trim()) {
        const text = stripHtml(blk.content).replace(/\s+/g, ' ').trim()
        return text.length > 220 ? text.slice(0, 220) + '…' : text
      }
    }
  }
  return '这篇稿子还没有正文。点开任何章节就能开始写。'
}

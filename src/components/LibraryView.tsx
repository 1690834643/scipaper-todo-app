import type { JSX } from 'react'
import type { Article, Thesis } from '../types'
import { useState, useMemo } from 'react'
import {
  countArticleWords,
  relativeTime,
  ARTICLE_STATUS_LABEL_ZH,
  THESIS_STATUS_LABEL_ZH,
  articleStatusToDataStatus,
  thesisStatusToDataStatus,
  type DataStatus,
} from '../utils/articleUtils'

type Filter = 'all' | 'drafts' | 'review' | 'published' | 'theses'

interface LibraryViewProps {
  articles: Article[]
  theses: Thesis[]
  onOpenArticle: (id: string) => void
  onOpenThesis: (id: string) => void
  onNewArticle: () => void
  onNewThesis: () => void
  onDeleteArticle: (id: string, title: string) => void | Promise<void>
}

type LibraryItem = {
  kind: 'article' | 'thesis'
  id: string
  title: string
  statusKey: DataStatus
  statusLabel: string
  wordCount: number
  updatedAt: string
  subtitle: string
}

export function LibraryView(props: LibraryViewProps): JSX.Element {
  const { articles, theses, onOpenArticle, onOpenThesis, onNewArticle, onNewThesis, onDeleteArticle } = props
  const [filter, setFilter] = useState<Filter>('all')

  const items = useMemo<LibraryItem[]>(() => {
    const result: LibraryItem[] = []
    for (const article of articles) {
      result.push({
        kind: 'article',
        id: article.id,
        title: article.title,
        statusKey: articleStatusToDataStatus(article.status),
        statusLabel: ARTICLE_STATUS_LABEL_ZH[article.status],
        wordCount: countArticleWords(article),
        updatedAt: article.updatedAt,
        subtitle: article.targetJournal,
      })
    }
    for (const thesis of theses) {
      result.push({
        kind: 'thesis',
        id: thesis.id,
        title: thesis.title,
        statusKey: thesisStatusToDataStatus(thesis.status),
        statusLabel: THESIS_STATUS_LABEL_ZH[thesis.status],
        wordCount: countArticleWords(thesis),
        updatedAt: thesis.updatedAt,
        subtitle: thesis.author,
      })
    }
    result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return result
  }, [articles, theses])

  const filteredItems = useMemo(() => {
    switch (filter) {
      case 'all':
        return items
      case 'drafts':
        return items.filter((i) => i.statusKey === 'draft')
      case 'review':
        return items.filter((i) => i.statusKey === 'review')
      case 'published':
        return items.filter((i) => i.statusKey === 'published')
      case 'theses':
        return items.filter((i) => i.kind === 'thesis')
    }
  }, [items, filter])

  const totalCount = articles.length + theses.length
  const isCompletelyEmpty = totalCount === 0
  const isFilteredEmpty = filteredItems.length === 0 && !isCompletelyEmpty

  return (
    <div>
      <div className="header-actions">
        <div>
          <p className="eyebrow">Library</p>
          <h1>稿件库</h1>
          <p>
            {articles.length} 篇文章 · {theses.length} 篇学位论文
          </p>
        </div>
        <div>
          <button className="primary-button" onClick={onNewArticle} type="button">
            + 新建文章
          </button>
          <button className="ghost-button" onClick={onNewThesis} type="button">
            + 新建学位论文
          </button>
        </div>
      </div>

      <div className="header-actions">
        <button
          className={`nav-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
          type="button"
        >
          全部
        </button>
        <button
          className={`nav-chip ${filter === 'drafts' ? 'active' : ''}`}
          onClick={() => setFilter('drafts')}
          type="button"
        >
          草稿
        </button>
        <button
          className={`nav-chip ${filter === 'review' ? 'active' : ''}`}
          onClick={() => setFilter('review')}
          type="button"
        >
          审稿中
        </button>
        <button
          className={`nav-chip ${filter === 'published' ? 'active' : ''}`}
          onClick={() => setFilter('published')}
          type="button"
        >
          已发表
        </button>
        <button
          className={`nav-chip ${filter === 'theses' ? 'active' : ''}`}
          onClick={() => setFilter('theses')}
          type="button"
        >
          学位论文
        </button>
      </div>

      {isCompletelyEmpty && (
        <div className="empty-library">
          <h3>还没有任何稿件</h3>
          <p>用右上的按钮新建一篇</p>
        </div>
      )}

      {isFilteredEmpty && (
        <div className="empty-library">
          <h3>没有符合筛选条件的稿件</h3>
          <p>切换筛选条件,或在右上新建一篇</p>
        </div>
      )}

      {!isCompletelyEmpty && !isFilteredEmpty && (
        <div className="library-grid">
          {filteredItems.map((item) => {
            const open = () =>
              item.kind === 'article' ? onOpenArticle(item.id) : onOpenThesis(item.id)
            return (
              <div
                key={item.id}
                className="library-card"
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open()
                  }
                }}
                style={{ position: 'relative' }}
              >
                {item.kind === 'article' && (
                  <button
                    type="button"
                    className="library-card-delete"
                    aria-label={`删除 ${item.title}`}
                    title="删除（不可撤销）"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`确定删除「${item.title}」？\n\n这会一并删除该论文的全部章节、附件、版本历史，且不可撤销。`)) {
                        onDeleteArticle(item.id, item.title)
                      }
                    }}
                    onKeyDown={(e) => {
                      // Don't let Enter/Space bubble to the parent (would open the card)
                      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 44,
                      height: 44,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      border: '1px solid var(--c-line)',
                      background: 'var(--c-panel)',
                      color: 'var(--c-ink-muted)',
                      cursor: 'pointer',
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
                <div className="library-card-cover">{Array.from(item.title)[0]?.toUpperCase() ?? ''}</div>
                <div className="library-card-body">
                  <p className="library-item-meta-row">
                    <span>{item.kind === 'article' ? 'Article' : 'Thesis'}</span>
                    <span data-status={item.statusKey} className="library-item-status">
                      {item.statusLabel}
                    </span>
                  </p>
                  <h3>{item.title}</h3>
                  <p>{item.subtitle}</p>
                </div>
                <div className="library-card-footer">
                  <span>{item.wordCount} 字</span>
                  <span>{relativeTime(item.updatedAt)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

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

type Filter = 'all' | 'drafts' | 'review' | 'published'
type KindFilter = 'all' | 'article' | 'thesis'
type SortKey = 'updatedDesc' | 'updatedAsc' | 'titleAsc' | 'wordsDesc'

interface LibraryViewProps {
  articles: Article[]
  theses: Thesis[]
  onOpenArticle: (id: string) => void
  onOpenThesis: (id: string) => void
  onNewArticle: () => void
  onNewThesis: () => void
  onDeleteArticle: (id: string, title: string) => void | Promise<void>
  onDeleteThesis: (id: string, title: string) => void | Promise<void>
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
  const { articles, theses, onOpenArticle, onOpenThesis, onNewArticle, onNewThesis, onDeleteArticle, onDeleteThesis } = props
  const [filter, setFilter] = useState<Filter>('all')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('updatedDesc')
  const [query, setQuery] = useState('')

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
    return result
  }, [articles, theses])

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const result = items.filter((item) => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false
      if (filter === 'drafts' && item.statusKey !== 'draft') return false
      if (filter === 'review' && item.statusKey !== 'review') return false
      if (filter === 'published' && item.statusKey !== 'published') return false
      if (!normalizedQuery) return true
      return [item.title, item.subtitle, item.statusLabel, item.kind === 'article' ? '小论文' : '大论文']
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    })
    result.sort((a, b) => {
      switch (sortKey) {
        case 'updatedAsc':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        case 'titleAsc':
          return a.title.localeCompare(b.title, 'zh-Hans')
        case 'wordsDesc':
          return b.wordCount - a.wordCount
        case 'updatedDesc':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
    })
    return result
  }, [items, filter, kindFilter, query, sortKey])

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
            {articles.length} 篇小论文 · {theses.length} 篇大论文
          </p>
        </div>
        <div>
          <button className="primary-button" onClick={onNewArticle} type="button">
            + 新建小论文
          </button>
          <button className="ghost-button" onClick={onNewThesis} type="button">
            + 新建大论文
          </button>
        </div>
      </div>

      <div className="header-actions" style={{ alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <button className={`nav-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')} type="button">
            全部状态
          </button>
          <button className={`nav-chip ${filter === 'drafts' ? 'active' : ''}`} onClick={() => setFilter('drafts')} type="button">
            草稿
          </button>
          <button className={`nav-chip ${filter === 'review' ? 'active' : ''}`} onClick={() => setFilter('review')} type="button">
            审稿中
          </button>
          <button className={`nav-chip ${filter === 'published' ? 'active' : ''}`} onClick={() => setFilter('published')} type="button">
            已发表
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', alignItems: 'center', justifyContent: 'flex-end' }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、期刊、作者"
            style={{ minWidth: 220 }}
          />
          <select className="ghost-button" value={kindFilter} onChange={(event) => setKindFilter(event.target.value as KindFilter)}>
            <option value="all">全部类型</option>
            <option value="article">只看小论文</option>
            <option value="thesis">只看大论文</option>
          </select>
          <select className="ghost-button" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
            <option value="updatedDesc">最近更新优先</option>
            <option value="updatedAsc">最早更新优先</option>
            <option value="titleAsc">标题 A-Z</option>
            <option value="wordsDesc">字数最多优先</option>
          </select>
        </div>
      </div>

      {isCompletelyEmpty && (
        <div className="empty-library">
          <h3>还没有任何稿件</h3>
          <p>用右上的按钮新建小论文或大论文</p>
        </div>
      )}

      {isFilteredEmpty && (
        <div className="empty-library">
          <h3>没有符合筛选条件的稿件</h3>
          <p>调整关键词、类型或状态筛选，或在右上新建一篇</p>
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
                <button
                  type="button"
                  className="library-card-delete"
                  aria-label={`删除 ${item.title}`}
                  title="删除（不可撤销）"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (item.kind === 'article') {
                      if (confirm(`确定删除小论文「${item.title}」？\n\n这会一并删除该小论文的全部章节、附件、版本历史，且不可撤销。`)) {
                        onDeleteArticle(item.id, item.title)
                      }
                      return
                    }
                    if (confirm(`确定删除大论文「${item.title}」？\n\n这会删除该大论文框架、章节结构和关联信息，但不会删除已关联的小论文。不可撤销。`)) {
                      onDeleteThesis(item.id, item.title)
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
                <div className="library-card-cover">{Array.from(item.title)[0]?.toUpperCase() ?? ''}</div>
                <div className="library-card-body">
                  <p className="library-item-meta-row">
                    <span>{item.kind === 'article' ? '小论文' : '大论文'}</span>
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

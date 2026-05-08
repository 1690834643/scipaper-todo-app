import type { JSX } from 'react'
import * as React from 'react'

export type AppRoute = 'home' | 'library' | 'article' | 'thesis' | 'settings' | 'daily'

interface AppSidebarProps {
  route: AppRoute
  onNavigate: (route: AppRoute) => void
  onNewArticle: () => void
  onNewThesis: () => void
  onOpenAi: () => void
  searchValue: string
  onSearchChange: (value: string) => void
  todayWords: number
  dailyGoal: number
  hasOpenArticle: boolean
  openArticleTitle?: string | null
  collapsed?: boolean
  onToggleCollapsed?: () => void
  /** Empty string falls back to the default brand name "papertodo". */
  userDisplayName?: string
}

function aiShortcutLabel(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '')) {
    return '⌘K'
  }
  return 'Ctrl K'
}

function navClass(route: AppRoute, current: AppRoute) {
  return route === current ? 'home-nav-item is-active' : 'home-nav-item'
}

// ARIA button keyboard contract: both Enter AND Space activate. Without Space
// support, screen-reader users navigating with arrow keys can't trigger nav.
function activateOn(handler: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler()
    }
  }
}

export function AppSidebar({
  route,
  onNavigate,
  onNewArticle,
  onNewThesis,
  onOpenAi,
  searchValue,
  onSearchChange,
  todayWords,
  dailyGoal,
  hasOpenArticle,
  openArticleTitle,
  collapsed = false,
  onToggleCollapsed,
  userDisplayName,
}: AppSidebarProps): JSX.Element {
  const brandLabel = (userDisplayName && userDisplayName.trim()) || 'papertodo'
  const brandGlyph = (userDisplayName && userDisplayName.trim()) ? [...userDisplayName.trim()][0].toUpperCase() : 'P'
  return (
    <aside className={`home-sidebar${collapsed ? ' is-collapsed' : ''}`}>
      <div className='home-sidebar-top'>
        <div className='home-brand'>
          <div className='home-brand-glyph'>{brandGlyph}</div>
          {!collapsed && <div className='home-brand-name'>{brandLabel}</div>}
        </div>
        {/* Always render the toggle so a `collapsed=true` sidebar without an
         * onToggleCollapsed handler isn't a permanent dead-end. Disabled state
         * is visible to screen readers via aria-disabled. */}
        <button
          type='button'
          className='btn ghost icon-only home-sidebar-collapse'
          onClick={onToggleCollapsed}
          disabled={!onToggleCollapsed}
          aria-disabled={!onToggleCollapsed}
          title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          aria-expanded={!collapsed}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {!collapsed && route === 'library' ? (
        <input
          className='sidebar-search'
          type='search'
          placeholder='在 Library 中筛选稿件…'
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      ) : null}

      <nav>
        {!collapsed && <p className='home-section-label'>Workspace</p>}
        <ul className='home-nav'>
          <li
            className={navClass(route, 'home')}
            onClick={() => onNavigate('home')}
            onKeyDown={activateOn(() => onNavigate('home'))}
            role='button'
            tabIndex={0}
            title='Home'
            aria-label='Home'
          >
            <span className='home-nav-icon'>◐</span>
            {!collapsed && <span className='home-nav-label'>Home</span>}
          </li>
          <li
            className={navClass(route, 'library')}
            onClick={() => onNavigate('library')}
            onKeyDown={activateOn(() => onNavigate('library'))}
            role='button'
            tabIndex={0}
            title='Library'
            aria-label='Library'
          >
            <span className='home-nav-icon'>▤</span>
            {!collapsed && <span className='home-nav-label'>Library</span>}
          </li>
          <li
            className={`${navClass(route, 'article')}${!hasOpenArticle ? ' is-disabled' : ''}`}
            onClick={() => hasOpenArticle && onNavigate('article')}
            onKeyDown={activateOn(() => { if (hasOpenArticle) onNavigate('article') })}
            role='button'
            tabIndex={hasOpenArticle ? 0 : -1}
            aria-disabled={!hasOpenArticle}
            title={hasOpenArticle && openArticleTitle ? `小论文 - ${openArticleTitle}` : '小论文'}
            aria-label={hasOpenArticle && openArticleTitle ? `小论文 - ${openArticleTitle}` : '小论文'}
          >
            <span className='home-nav-icon'>✎</span>
            {!collapsed && <span className='home-nav-label'>小论文</span>}
            {!collapsed && hasOpenArticle && openArticleTitle ? (
              <span className='home-nav-aside'>{openArticleTitle.slice(0, 14)}</span>
            ) : null}
          </li>
        </ul>

        {!collapsed && <p className='home-section-label' style={{ marginTop: 'var(--sp-5)' }}>Tools</p>}
        <ul className='home-nav'>
          <li
            className={navClass(route, 'daily')}
            onClick={() => onNavigate('daily')}
            onKeyDown={activateOn(() => onNavigate('daily'))}
            role='button'
            tabIndex={0}
            title='Daily Log'
            aria-label='Daily Log'
          >
            <span className='home-nav-icon'>☉</span>
            {!collapsed && <span className='home-nav-label'>Daily Log</span>}
          </li>
          <li
            className={navClass(route, 'settings')}
            onClick={() => onNavigate('settings')}
            onKeyDown={activateOn(() => onNavigate('settings'))}
            role='button'
            tabIndex={0}
            title='Settings'
            aria-label='Settings'
          >
            <span className='home-nav-icon'>⚙</span>
            {!collapsed && <span className='home-nav-label'>Settings</span>}
          </li>
          <li
            className='home-nav-item'
            onClick={onOpenAi}
            onKeyDown={activateOn(onOpenAi)}
            role='button'
            tabIndex={0}
            title={`AI 助手 (${aiShortcutLabel()})`}
            aria-label={`AI 助手 (${aiShortcutLabel()})`}
          >
            <span className='home-nav-icon'>✦</span>
            {!collapsed && <span className='home-nav-label'>AI 助手</span>}
            {!collapsed && <span className='home-nav-aside'>{aiShortcutLabel()}</span>}
          </li>
        </ul>

        {!collapsed && (
          <>
            <p className='home-section-label' style={{ marginTop: 'var(--sp-5)' }}>Create</p>
            <div className='sidebar-create'>
              <button className='btn ghost sm full-width' onClick={onNewArticle} type='button'>
                + 新建小论文
              </button>
              <button className='btn ghost sm full-width' onClick={onNewThesis} type='button'>
                + 新建大论文
              </button>
            </div>
          </>
        )}
      </nav>

      {!collapsed && (
        <div className='home-mini-card sidebar-progress'>
          <span className='sidebar-progress-line'>
            <span className='sidebar-progress-num'>{todayWords.toLocaleString()}</span>
            <span className='sidebar-progress-goal'> / {dailyGoal.toLocaleString()} 字</span>
          </span>
          <span className='home-mini-card-label'>今日写作进度</span>
          <div className='sidebar-progress-bar'>
            <div
              className='sidebar-progress-fill'
              style={{
                width: `${dailyGoal > 0 ? Math.min(100, Math.round((todayWords / dailyGoal) * 100)) : 0}%`,
              }}
            />
          </div>
        </div>
      )}
    </aside>
  )
}

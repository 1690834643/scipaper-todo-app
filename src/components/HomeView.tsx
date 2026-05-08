import type { AppState, Article, ProgressEntry } from '../types'
import type { AppRoute } from './AppSidebar'
import {
  countArticleWords,
  relativeTime,
} from '../utils/articleUtils'
import { localIsoDate } from '../utils/dateUtils'
import { articleExcerpt } from '../utils/articleExcerpt'

const HEATMAP_WEEKS = 16
const HEATMAP_DAYS = HEATMAP_WEEKS * 7
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_ABBR = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

// 热度分级阈值。1 score = 200 字 OR 1 条 progress entry。
// lvl 4 (最深) 需要 ~4000 字 / 20 条 / 等价混合 —— 真正用力的一天才到顶。
const HEATMAP_THRESHOLDS = { lv1: 1, lv2: 4, lv3: 10, lv4: 20 } as const

interface HeatmapCell {
  date: string
  dayOfMonth: number
  weekday: number
  monthIdx: number
  words: number
  entries: number
  level: 0 | 1 | 2 | 3 | 4
  isToday: boolean
  isFuture: boolean
}

function buildHeatmap(
  streakHistory: { date: string; words: number }[],
  progressEntries: ProgressEntry[],
): { cells: HeatmapCell[]; monthMarkers: { col: number; label: string }[] } {
  const todayIso = localIsoDate()
  const wordsByDate = new Map(streakHistory.map((d) => [d.date, d.words]))
  const entriesByDate = new Map<string, number>()
  for (const e of progressEntries) {
    entriesByDate.set(e.date, (entriesByDate.get(e.date) ?? 0) + 1)
  }

  // 末尾对齐到本周日。回退 HEATMAP_WEEKS-1 周到周日，作为起点。
  const today = new Date()
  const endSunday = new Date(today)
  endSunday.setHours(0, 0, 0, 0)
  endSunday.setDate(endSunday.getDate() + (6 - endSunday.getDay()))

  const start = new Date(endSunday)
  start.setDate(start.getDate() - (HEATMAP_DAYS - 1))

  const cells: HeatmapCell[] = []
  const monthMarkers: { col: number; label: string }[] = []
  let lastMonth = -1

  for (let i = 0; i < HEATMAP_DAYS; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const iso = localIsoDate(d)
    const words = wordsByDate.get(iso) ?? 0
    const entries = entriesByDate.get(iso) ?? 0
    const score = Math.floor(words / 200) + entries
    let level: 0 | 1 | 2 | 3 | 4 = 0
    if (score >= HEATMAP_THRESHOLDS.lv4) level = 4
    else if (score >= HEATMAP_THRESHOLDS.lv3) level = 3
    else if (score >= HEATMAP_THRESHOLDS.lv2) level = 2
    else if (score >= HEATMAP_THRESHOLDS.lv1) level = 1

    const monthIdx = d.getMonth()
    if (monthIdx !== lastMonth) {
      const col = Math.floor(i / 7)
      monthMarkers.push({ col, label: MONTH_ABBR[monthIdx] })
      lastMonth = monthIdx
    }

    cells.push({
      date: iso,
      dayOfMonth: d.getDate(),
      weekday: d.getDay(),
      monthIdx,
      words,
      entries,
      level,
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
    })
  }

  return { cells, monthMarkers }
}

interface HomeViewProps {
  state: AppState
  onResume: (articleId: string) => void
  onNavigate: (route: AppRoute) => void
}

function timeOfDay() {
  const hour = new Date().getHours()
  if (hour < 6) return { greeting: '深夜好', mood: '正无声', period: 'night' }
  if (hour < 12) return { greeting: '早上好', mood: '正显影', period: 'morning' }
  if (hour < 14) return { greeting: '中午好', mood: '正成形', period: 'noon' }
  if (hour < 18) return { greeting: '下午好', mood: '正沉潜', period: 'afternoon' }
  if (hour < 22) return { greeting: '晚上好', mood: '正回响', period: 'evening' }
  return { greeting: '夜深了', mood: '正未竟', period: 'late' }
}

function formatNow() {
  const now = new Date()
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()]
  const hh = now.getHours().toString().padStart(2, '0')
  const mm = now.getMinutes().toString().padStart(2, '0')
  return `星期${weekday}, ${hh}:${mm}`
}

function unresolvedComments(article: Article): number {
  let n = 0
  for (const round of article.reviewRounds) {
    for (const c of round.comments) {
      if (c.status !== 'Completed') n += 1
    }
  }
  return n
}

function sectionProgress(article: Article): number {
  if (!article.sections.length) return 0
  const filled = article.sections.filter(s =>
    s.contentBlocks.some(b => b.type === 'Text' && b.content && b.content.trim().length > 30),
  ).length
  return Math.round((filled / article.sections.length) * 100)
}

function totalCitations(state: AppState): number {
  return state.articles.reduce((acc, a) => acc + (a.citations?.length || 0), 0)
}

function draftCount(state: AppState): number {
  return state.articles.filter(a => a.status === 'Drafting').length
}

function pickRecent(state: AppState, n: number): Article[] {
  return [...state.articles]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, n)
}

export function HomeView({ state, onResume, onNavigate }: HomeViewProps) {
  const tod = timeOfDay()
  const recent = pickRecent(state, 1)[0] ?? null
  const streak = state.writingStreak
  const todayWords = streak?.todayWords ?? 0
  const dailyGoal = streak?.dailyGoal ?? 1000
  const goalPct = dailyGoal > 0 ? Math.min(100, Math.round((todayWords / dailyGoal) * 100)) : 0
  const recentWords = recent ? countArticleWords(recent) : 0
  const recentExcerpt = recent ? articleExcerpt(recent) : ''
  const recentSecProgress = recent ? sectionProgress(recent) : 0

  const last7 = (() => {
    const history = streak?.streakHistory ?? []
    const map = new Map(history.map(d => [d.date, d.words]))
    const out: { day: string; words: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = localIsoDate(d)
      out.push({
        day: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
        words: map.get(iso) ?? 0,
      })
    }
    return out
  })()
  const weekMax = Math.max(1, ...last7.map(d => d.words))

  const heatmap = buildHeatmap(
    streak?.streakHistory ?? [],
    state.progressEntries ?? [],
  )
  const heatmapByCol: HeatmapCell[][] = []
  for (let c = 0; c < HEATMAP_WEEKS; c++) {
    heatmapByCol.push(heatmap.cells.slice(c * 7, c * 7 + 7))
  }
  const heatmapTotals = heatmap.cells.reduce(
    (acc, cell) => {
      if (cell.isFuture) return acc
      acc.words += cell.words
      acc.entries += cell.entries
      if (cell.level > 0) acc.activeDays += 1
      return acc
    },
    { words: 0, entries: 0, activeDays: 0 },
  )

  return (
    <div className="home-route">
      <main className="home-main">
        {/* Hero greeting (含名言) */}
        <section className="home-hero">
          <div>
            <p className="home-hero-eyebrow">{formatNow()} · {tod.period}</p>
            <h1 className="home-hero-title">
              {tod.greeting}{state.userProfile?.displayName ? `, ${state.userProfile.displayName}` : ''},<br />
              your study is <em>{tod.mood}</em>.
            </h1>
            <div className="home-hero-rule"></div>
            <p className="home-hero-sub">
              {recent
                ? `你最近在《${recent.title}》停笔。${recentSecProgress}% 章节有了内容,继续把它写完。`
                : '还没有稿件。先新建一篇文章或记录一项进展。'}
            </p>
            <p className="home-hero-aphorism">
              <span>"白纸从来不是白的:它已经在和你争论了。"</span>
              <cite>from your own §03, redrafted six times</cite>
            </p>
          </div>
          <div className="home-hero-meta">
            <div><strong>{draftCount(state)}</strong> drafts in flight</div>
            <div><strong>{totalCitations(state)}</strong> citations queued</div>
            <div>{recent
              ? <><strong>{relativeTime(recent.updatedAt)}</strong> autosaved</>
              : <><strong>—</strong> no autosave yet</>
            }</div>
          </div>
        </section>

        {/* 月度热力图 + This week, in numbers (并排) */}
        <section className="home-pulse">
          <div className="home-heatmap">
            <div className="home-heatmap-head">
              <div>
                <span className="home-heatmap-eyebrow">PAST {HEATMAP_WEEKS} WEEKS · 进展密度</span>
                <h2 className="home-heatmap-title">
                  {heatmapTotals.activeDays} 天动过 · {heatmapTotals.words.toLocaleString()} 字 · {heatmapTotals.entries} 条
                </h2>
              </div>
              <div className="home-heatmap-legend">
                <span>少</span>
                {[0, 1, 2, 3, 4].map((lv) => (
                  <span key={lv} className={`home-heatmap-cell home-heatmap-cell--lv${lv}`} aria-hidden />
                ))}
                <span>多</span>
              </div>
            </div>
            <div className="home-heatmap-grid">
              <div className="home-heatmap-weekday-axis">
                {WEEKDAY_LABELS.map((d, i) => (
                  <span key={i} className={i % 2 === 1 ? '' : 'is-hidden'}>{d}</span>
                ))}
              </div>
              <div className="home-heatmap-cols">
                <div
                  className="home-heatmap-month-axis"
                  style={{ gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, 1fr)` }}
                >
                  {Array.from({ length: HEATMAP_WEEKS }).map((_, col) => {
                    const marker = heatmap.monthMarkers.find((m) => m.col === col)
                    return <span key={col}>{marker ? marker.label : ''}</span>
                  })}
                </div>
                <div
                  className="home-heatmap-cells"
                  style={{ gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, 1fr)` }}
                >
                  {heatmapByCol.map((week, ci) => (
                    <div key={ci} className="home-heatmap-week">
                      {week.map((cell) => (
                        <span
                          key={cell.date}
                          className={`home-heatmap-cell home-heatmap-cell--lv${cell.level}${cell.isToday ? ' is-today' : ''}${cell.isFuture ? ' is-future' : ''}`}
                          title={`${cell.date} · ${cell.words} 字 · ${cell.entries} 条`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="home-pulse-side">
            <div className="home-pulse-stat">
              <span className="home-stat-label">Words today</span>
              <span className="home-stat-num">{todayWords.toLocaleString()}</span>
              <span className={`home-stat-trend ${todayWords >= dailyGoal ? 'up' : ''}`}>
                {dailyGoal > 0
                  ? `${goalPct}% / 目标 ${dailyGoal.toLocaleString()}`
                  : '未设目标'}
              </span>
            </div>
            <div className="home-pulse-week">
              <span className="home-stat-label">本周字数 · 每天</span>
              <div className="home-week-bars">
                {last7.map((d, idx) => {
                  const isToday = idx === last7.length - 1
                  return (
                    <div
                      key={idx}
                      className={`home-week-bar ${isToday ? 'is-today' : ''}`}
                      title={`${d.day} · ${d.words} 字`}
                    >
                      {d.words > 0 ? (
                        <span className="home-week-bar-count">{d.words}</span>
                      ) : null}
                      <div
                        className="home-week-bar-fill"
                        style={{ height: `${weekMax > 0 ? (d.words / weekMax) * 100 : 0}%` }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="home-week-axis">
                {last7.map((d, idx) => (
                  <span key={idx} className={idx === last7.length - 1 ? 'is-today' : ''}>{d.day}</span>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="home-pulse-link"
              onClick={() => onNavigate('settings')}
            >
              Open analytics ↗
            </button>
          </aside>
        </section>

        {/* Continue reading hero */}
        {recent ? (
          <section className="home-continue">
            <div>
              <p className="home-continue-eyebrow">Continue · {recent.title}</p>
              <h2 className="home-continue-title">{recent.title}</h2>
              <p className="home-continue-excerpt">{recentExcerpt}</p>
              <div className="home-continue-meta">
                <span>{recentWords.toLocaleString()} words</span>
                <span>{recent.sections.length} sections</span>
                <span>{recent.citations?.length ?? 0} citations</span>
                <span>{unresolvedComments(recent)} unresolved comments</span>
              </div>
            </div>
            <div className="home-continue-aside">
              <div className="home-continue-progress">
                <span className="home-section-label">Section progress</span>
                <div className="home-continue-bar">
                  <div className="home-continue-bar-fill" style={{ width: `${recentSecProgress}%` }}></div>
                </div>
                <span className="home-stat-trend">{recentSecProgress}% 章节有了内容</span>
              </div>
              <div className="home-continue-progress">
                <span className="home-section-label">Word goal · today</span>
                <div className="home-continue-bar">
                  <div className="home-continue-bar-fill" style={{ width: `${goalPct}%` }}></div>
                </div>
                <span className={`home-stat-trend ${todayWords >= dailyGoal ? 'up' : ''}`}>
                  {todayWords.toLocaleString()} / {dailyGoal.toLocaleString()} words
                </span>
              </div>
              <button
                className="home-continue-resume"
                onClick={() => onResume(recent.id)}
                type="button"
              >
                Resume writing →
              </button>
            </div>
          </section>
        ) : null}


      </main>
    </div>
  )
}

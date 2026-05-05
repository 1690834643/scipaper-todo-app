import { useEffect, useState, type JSX } from 'react'
import type {
  AppState,
  ProgressEntry,
  ProgressEntryKind,
  DailySession,
  Article,
  MoodType,
} from '../types'
import { PomodoroTimer } from './PomodoroTimer'
import { MoodTracker } from './MoodTracker'
import { pickKickoffPlaceholder } from '../utils/jokesAndAnalogies'
import { localIsoDate } from '../utils/dateUtils'

const KIND_LABELS: Record<ProgressEntryKind, string> = {
  read: '读',
  experiment: '实验',
  writing: '写',
  idea: '想',
  cite: '录',
  analysis: '析',
  focus: '专注',
  mood: '心情',
}

const KIND_COLORS: Record<ProgressEntryKind, string> = {
  read: '#3a82bd',
  experiment: '#a3653f',
  writing: '#2e7d57',
  idea: '#b08a2e',
  cite: '#6b6b9a',
  analysis: '#8a3f6c',
  focus: '#5b8a72',
  mood: '#c89372',
}

// 用户可手动新增的 kinds（focus / mood / writing 都从其它途径自动产生）
const MANUAL_KINDS: ProgressEntryKind[] = ['read', 'experiment', 'idea', 'cite', 'analysis']

interface DailyLogViewProps {
  state: AppState
  onAddProgressEntry: (payload: {
    articleId: string
    kind: ProgressEntryKind
    title: string
    detail?: string
    minutesSpent?: number
  }) => Promise<void>
  onDeleteProgressEntry: (entryId: string) => Promise<void>
  onSetDailyPlan: (planText: string) => Promise<void>
  onEndDailySession: (summaryText: string) => Promise<void>
  onAddPomodoro: (duration: number) => Promise<void>
  onAddMood: (mood: MoodType, note?: string) => Promise<void>
  onUpdateGoal: (goal: number) => Promise<void>
  onShareToday: () => void
}

function todayDate(): string {
  return localIsoDate()
}

function findArticleTitle(articles: Article[], articleId: string): string {
  if (!articleId) return '未归属'
  return articles.find((a) => a.id === articleId)?.title || '(已删除)'
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '深夜好'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  if (hour < 22) return '晚上好'
  return '夜深了'
}

function formatHHMM(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toTimeString().slice(0, 5)
  } catch {
    return ''
  }
}

export function DailyLogView({
  state,
  onAddProgressEntry,
  onDeleteProgressEntry,
  onSetDailyPlan,
  onEndDailySession,
  onAddPomodoro,
  onAddMood,
  onUpdateGoal,
  onShareToday,
}: DailyLogViewProps): JSX.Element {
  const today = todayDate()
  const session: DailySession | null =
    (state.dailySessions || []).find((s) => s.date === today) || null
  const todayEntries: ProgressEntry[] = (state.progressEntries || []).filter(
    (e) => e.date === today,
  )

  const streak = state.writingStreak
  const todayWords = streak?.todayWords ?? 0
  const dailyGoal = streak?.dailyGoal ?? 1000
  const goalPct = dailyGoal > 0 ? Math.min(100, Math.round((todayWords / dailyGoal) * 100)) : 0
  const focusMinutes = todayEntries
    .filter((e) => e.kind === 'focus')
    .reduce((sum, e) => sum + (e.minutesSpent || 0), 0)

  const [planDraft, setPlanDraft] = useState(session?.planText || '')
  const [summaryDraft, setSummaryDraft] = useState(session?.summaryText || '')
  const [planJustSaved, setPlanJustSaved] = useState(false)
  const [summaryJustSaved, setSummaryJustSaved] = useState(false)
  const [planPlaceholder] = useState(() => pickKickoffPlaceholder())
  const [goalDraft, setGoalDraft] = useState(String(dailyGoal))
  const [goalEditing, setGoalEditing] = useState(false)

  const [newArticleId, setNewArticleId] = useState<string>(state.articles[0]?.id || '')
  const [newKind, setNewKind] = useState<ProgressEntryKind>('read')
  const [newTitle, setNewTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setPlanDraft(session?.planText || '')
    setSummaryDraft(session?.summaryText || '')
  }, [session?.planText, session?.summaryText])

  useEffect(() => {
    setGoalDraft(String(dailyGoal))
  }, [dailyGoal])

  useEffect(() => {
    if (!newArticleId) return
    const stillExists = state.articles.some((a) => a.id === newArticleId)
    if (!stillExists) setNewArticleId(state.articles[0].id)
  }, [state.articles, newArticleId])

  const counts: { kind: ProgressEntryKind; n: number }[] = (
    Object.keys(KIND_LABELS) as ProgressEntryKind[]
  )
    .map((k) => {
      if (k === 'writing') return { kind: k, n: todayWords > 0 ? 1 : 0 }
      return { kind: k, n: todayEntries.filter((e) => e.kind === k).length }
    })
    .filter((x) => x.n > 0)
  const heroProgressTotal = counts.reduce((sum, c) => sum + c.n, 0)

  async function handleSavePlan() {
    if (planDraft === (session?.planText || '')) return
    await onSetDailyPlan(planDraft)
    setPlanJustSaved(true)
    setTimeout(() => setPlanJustSaved(false), 2500)
  }

  async function handleEndSession() {
    await onEndDailySession(summaryDraft)
    setSummaryJustSaved(true)
    setTimeout(() => setSummaryJustSaved(false), 2500)
  }

  async function handleAddEntry() {
    if (!newTitle.trim() || submitting) return
    setSubmitting(true)
    try {
      await onAddProgressEntry({
        articleId: newArticleId,
        kind: newKind,
        title: newTitle.trim(),
      })
      setNewTitle('')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveGoal() {
    const next = parseInt(goalDraft, 10)
    if (Number.isFinite(next) && next > 0 && next !== dailyGoal) {
      await onUpdateGoal(next)
    }
    setGoalEditing(false)
  }

  async function handleFocusFinished(minutes: number) {
    await onAddProgressEntry({
      articleId: newArticleId,
      kind: 'focus',
      title: `专注 ${minutes} 分钟`,
      minutesSpent: minutes,
    })
  }

  async function handleMoodRecorded(_mood: MoodType, label: string, emoji: string, note?: string) {
    await onAddProgressEntry({
      articleId: newArticleId,
      kind: 'mood',
      title: `${emoji} ${label}`,
      detail: note,
    })
  }

  return (
    <div className='daily-log-route'>
      <main className='daily-log-main'>
        {/* === Hero: 一切融合在这里 === */}
        <header className='daily-log-hero'>
          <div className='daily-log-hero-top'>
            <div className='daily-log-hero-greet'>
              <p className='home-hero-eyebrow'>{today} · {timeOfDayGreeting()}{state.userProfile?.displayName ? `, ${state.userProfile.displayName}` : ''}</p>
              <h1 className='home-hero-title'>今日 · {heroProgressTotal} 项进展</h1>
              <p className='home-hero-sub'>
                {counts.length === 0
                  ? '今天还没记。随便写一条都比空白强。'
                  : counts.map((c) => `${KIND_LABELS[c.kind]} ${c.n}`).join('  ·  ')}
                <button className='daily-log-share-link' type='button' onClick={onShareToday}>
                  · 生成今日海报 ↗
                </button>
              </p>
            </div>

            <div className='daily-log-stat daily-log-stat--mood daily-log-hero-mood'>
              <span className='daily-log-stat-label'>心情</span>
              <MoodTracker
                moodHistory={state.writingStreak.moodHistory ?? []}
                onAddMood={onAddMood}
                onMoodRecorded={handleMoodRecorded}
              />
            </div>
          </div>

          <div className='daily-log-hero-bottom'>
            <div className='daily-log-hero-stats-compact'>
              <div className='daily-log-statc'>
                <span className='daily-log-statc-label'>字数</span>
                <span className='daily-log-statc-num'>{todayWords.toLocaleString()}</span>
                <span className='daily-log-statc-sub'>
                  {goalEditing ? (
                    <input
                      type='number'
                      value={goalDraft}
                      onChange={(e) => setGoalDraft(e.target.value)}
                      onBlur={handleSaveGoal}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveGoal()
                        if (e.key === 'Escape') {
                          setGoalDraft(String(dailyGoal))
                          setGoalEditing(false)
                        }
                      }}
                      autoFocus
                      className='daily-log-statc-input'
                    />
                  ) : (
                    <button
                      type='button'
                      className='daily-log-statc-goal'
                      onClick={() => setGoalEditing(true)}
                      title='点击修改目标'
                    >
                      / {dailyGoal.toLocaleString()} ({goalPct}%)
                    </button>
                  )}
                </span>
              </div>

              <div className='daily-log-statc'>
                <span className='daily-log-statc-label'>连续</span>
                <span className='daily-log-statc-num'>{streak?.currentStreak ?? 0}</span>
                <span className='daily-log-statc-sub'>最长 {streak?.longestStreak ?? 0} 天</span>
              </div>

              <div className='daily-log-statc'>
                <span className='daily-log-statc-label'>专注</span>
                <span className='daily-log-statc-num'>{focusMinutes}</span>
                <span className='daily-log-statc-sub'>分钟</span>
              </div>
            </div>

            <div className='daily-log-hero-pomo-row'>
              <span className='daily-log-statc-label daily-log-pomo-label'>番茄钟</span>
              <PomodoroTimer
                stats={state.pomodoroStats}
                onAddSession={onAddPomodoro}
                onSessionFinished={handleFocusFinished}
              />
            </div>
          </div>
        </header>

        {/* Plan + Summary */}
        <div className='daily-log-grid'>
          <section className='daily-log-section'>
            <div className='home-h'>
              <h2>今天的 plan</h2>
              <span className='home-stat-trend'>{planJustSaved ? '已保存' : ''}</span>
            </div>
            <textarea
              className='daily-log-plan'
              value={planDraft}
              onChange={(e) => setPlanDraft(e.target.value)}
              onBlur={handleSavePlan}
              placeholder={planPlaceholder}
              rows={3}
            />
          </section>

          <section className='daily-log-section'>
            <div className='home-h'>
              <h2>收尾总结</h2>
              <span className='home-stat-trend'>{summaryJustSaved ? '已保存' : ''}</span>
            </div>
            <textarea
              className='daily-log-plan'
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              placeholder='今天大概干了啥，明天接着搞什么。可以空。'
              rows={3}
            />
            <button className='primary-button' type='button' onClick={handleEndSession}>
              {session?.endedAt ? '更新收尾总结' : '结束今天'}
            </button>
          </section>
        </div>

        {/* 时间线（顶部紧贴一个输入头：记一笔） */}
        <section className='daily-log-section'>
          <div className='home-h'>
            <h2>今日时间线</h2>
            <span className='home-stat-trend'>{todayEntries.length} 条</span>
          </div>

          <div className='daily-log-timeline-input'>
            <select
              className='daily-log-select'
              value={newArticleId}
              onChange={(e) => setNewArticleId(e.target.value)}
            >
              <option value="">未归属</option>
              {state.articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <select
              className='daily-log-select'
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as ProgressEntryKind)}
            >
              {MANUAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}（{k}）
                </option>
              ))}
            </select>
            <input
              className='daily-log-input'
              type='text'
              placeholder='一句话写下你刚做了什么…'
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleAddEntry()
                }
              }}
            />
            <button
              className='primary-button'
              type='button'
              onClick={() => void handleAddEntry()}
              disabled={!newTitle.trim() || submitting}
            >
              记下
            </button>
          </div>

          {todayEntries.length === 0 ? (
            <p className='daily-log-empty'>还没有记录。在上面写一笔，回车即可。</p>
          ) : (
            <ul className='daily-log-timeline'>
              {todayEntries.map((entry) => (
                <li key={entry.id} className='daily-log-entry'>
                  <span
                    className='daily-log-kind'
                    style={{ background: KIND_COLORS[entry.kind] }}
                  >
                    {KIND_LABELS[entry.kind]}
                  </span>
                  <div className='daily-log-entry-body'>
                    <p className='daily-log-entry-title'>{entry.title}</p>
                    {entry.detail ? (
                      <p className='daily-log-entry-detail'>{entry.detail}</p>
                    ) : null}
                    <p className='daily-log-entry-meta'>
                      {formatHHMM(entry.createdAt)}
                      {' · '}
                      {findArticleTitle(state.articles, entry.articleId)}
                      {entry.minutesSpent ? ` · ${entry.minutesSpent} 分钟` : ''}
                      {entry.createdBy === 'ai' ? ' · AI 协作' : ''}
                    </p>
                  </div>
                  <button
                    className='daily-log-delete'
                    type='button'
                    onClick={() => void onDeleteProgressEntry(entry.id)}
                    aria-label='删除条目'
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

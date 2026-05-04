import { useEffect, useState } from 'react'
import type { WritingStreak as WritingStreakType } from '../types'
import { getHeatmapData } from '../utils/streakTracker'

interface WritingStreakProps {
  streak: WritingStreakType
  onUpdateGoal: (goal: number) => Promise<void>
  onShareToday?: () => void
}

const SESSION_KEY = 'scipaper.activeWritingSession'

function readSessionStart(): string | null {
  if (typeof window === 'undefined') return null
  let v: string | null = null
  try { v = window.localStorage.getItem(SESSION_KEY) } catch { return null }
  if (!v) return null
  // sanity: must be ISO string from this same calendar day
  const d = new Date(v)
  if (isNaN(d.getTime())) return null
  return v
}

function formatElapsed(startIso: string, nowMs: number): string {
  const start = new Date(startIso).getTime()
  const sec = Math.max(0, Math.floor((nowMs - start) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function WritingStreak({ streak, onUpdateGoal, onShareToday }: WritingStreakProps) {
  const [showGoalInput, setShowGoalInput] = useState(false)
  const [goalDraft, setGoalDraft] = useState(streak.dailyGoal.toString())
  const [sessionStart, setSessionStart] = useState<string | null>(() => readSessionStart())
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    if (!sessionStart) return
    const handle = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(handle)
  }, [sessionStart])

  function startWriting() {
    const iso = new Date().toISOString()
    try { window.localStorage.setItem(SESSION_KEY, iso) } catch {}
    setSessionStart(iso)
    setNow(Date.now())
  }

  function endWriting() {
    try { window.localStorage.removeItem(SESSION_KEY) } catch {}
    setSessionStart(null)
    if (onShareToday) onShareToday()
  }

  const heatmapData = getHeatmapData(streak.streakHistory, 28)

  const addedWords = streak.todayAddedWords ?? streak.todayWords ?? 0
  const removedWords = streak.todayRemovedWords ?? 0
  const changedWords = streak.todayChangedWords ?? (addedWords + removedWords)
  const netWords = streak.todayWords ?? (addedWords - removedWords)
  const byAI = streak.todayByAI ?? 0
  const byManual = streak.todayByManual ?? 0
  const pct = streak.dailyGoal > 0 ? Math.min(100, (netWords / streak.dailyGoal) * 100) : 0

  async function handleUpdateGoal() {
    const newGoal = parseInt(goalDraft, 10)
    if (!isNaN(newGoal) && newGoal >= 0) {
      await onUpdateGoal(newGoal)
      setShowGoalInput(false)
    }
  }

  return (
    <section className="panel-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Writing Streak</p>
          <h3>写作打卡</h3>
        </div>
        <div className="streak-badge">
          <span className="streak-flame">🔥</span>
          <span className="streak-count">{streak.currentStreak}</span>
        </div>
      </div>

      <div
        className="panel-card"
        style={{
          margin: '0 0 var(--sp-3) 0',
          padding: 'var(--sp-3)',
          background: sessionStart ? 'var(--c-accent-soft, rgba(163,101,63,0.10))' : 'var(--c-panel-sub)',
          border: '1px solid var(--c-line)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow" style={{ marginBottom: 4 }}>
              {sessionStart ? '✍️ 写作中' : '今日时段'}
            </p>
            {sessionStart ? (
              <p style={{ fontSize: 'var(--fs-lg)', fontFamily: 'var(--font-mono)', margin: 0 }}>
                {formatElapsed(sessionStart, now)}
              </p>
            ) : (
              <p className="muted-text" style={{ margin: 0, fontSize: 'var(--fs-xs)' }}>
                点击开始计时；结束后自动出海报
              </p>
            )}
          </div>
          {sessionStart ? (
            <button className="primary-button" onClick={endWriting} type="button">
              结束写作 · 出海报
            </button>
          ) : (
            <button className="primary-button" onClick={startWriting} type="button" disabled={!onShareToday}>
              开始写作
            </button>
          )}
        </div>
      </div>

      <div className="streak-stats">
        <div className="streak-stat">
          <span className="streak-stat-label">当前连续</span>
          <span className="streak-stat-value">{streak.currentStreak} 天</span>
        </div>
        <div className="streak-stat">
          <span className="streak-stat-label">最长连续</span>
          <span className="streak-stat-value">{streak.longestStreak} 天</span>
        </div>
        <div className="streak-stat">
          <span className="streak-stat-label">写作天数</span>
          <span className="streak-stat-value">{streak.totalWritingDays} 天</span>
        </div>
      </div>

      <div className="daily-progress">
        <div className="progress-header">
          <span>今日进度</span>
          <span>{netWords} / {streak.dailyGoal} 字</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="streak-detail" style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)', fontSize: 'var(--fs-xs)', color: 'var(--c-ink-muted)' }}>
          <span>+{addedWords} 添加</span>
          <span>-{removedWords} 删除</span>
          <span>{changedWords} 总改动</span>
        </div>
        {byAI > 0 && (
          <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-1)', fontSize: 'var(--fs-xs)', color: 'var(--c-ink-muted)' }}>
            <span>AI 协作 {byAI} 字 · 你独立 {byManual} 字</span>
          </div>
        )}
        {netWords >= streak.dailyGoal && netWords > 0 && (
          <div className="goal-met">✅ 今日目标已完成！</div>
        )}
      </div>

      {showGoalInput ? (
        <div className="goal-input-row">
          <input
            type="number"
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            placeholder="每日目标字数"
            min="0"
          />
          <button className="ghost-button" onClick={handleUpdateGoal}>
            保存
          </button>
          <button className="ghost-button" onClick={() => setShowGoalInput(false)}>
            取消
          </button>
        </div>
      ) : (
        <button
          className="ghost-button full-width"
          onClick={() => setShowGoalInput(true)}
        >
          设置每日目标 (当前: {streak.dailyGoal} 字)
        </button>
      )}

      <div className="heatmap-section">
        <p className="eyebrow">过去 28 天</p>
        <div className="heatmap-grid">
          {heatmapData.map((day) => (
            <div
              key={day.date}
              className="heatmap-cell"
              data-level={day.level}
              title={`${day.date}: ${day.words} 字`}
            />
          ))}
        </div>
        <div className="heatmap-legend">
          <span>少</span>
          <div className="heatmap-cell" data-level="0" />
          <div className="heatmap-cell" data-level="1" />
          <div className="heatmap-cell" data-level="2" />
          <div className="heatmap-cell" data-level="3" />
          <div className="heatmap-cell" data-level="4" />
          <span>多</span>
        </div>
      </div>
    </section>
  )
}

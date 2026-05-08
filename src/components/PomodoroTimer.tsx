import { useState, useEffect, useRef } from 'react'
import type { PomodoroStats } from '../types'

interface PomodoroTimerProps {
  stats: PomodoroStats
  onAddSession: (duration: number) => Promise<void>
  /**
   * Called when a focus session naturally completes (not on manual stop).
   * Used to write a ProgressEntry kind='focus'.
   */
  onSessionFinished?: (durationMinutes: number) => void
  autoStart?: boolean
}

const PRESET_DURATIONS = [15, 25, 45]

function formatMMSS(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function PomodoroTimer({
  stats,
  onAddSession,
  onSessionFinished,
  autoStart,
}: PomodoroTimerProps) {
  const [duration, setDuration] = useState(25)
  const [elapsed, setElapsed] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'running' | 'paused'>('idle')

  const onAddSessionRef = useRef(onAddSession)
  const onFinishedRef = useRef(onSessionFinished)
  const hasAutoStartedRef = useRef(false)

  useEffect(() => { onAddSessionRef.current = onAddSession }, [onAddSession])
  useEffect(() => { onFinishedRef.current = onSessionFinished }, [onSessionFinished])

  useEffect(() => {
    if (autoStart && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true
      setElapsed(0)
      setPhase('running')
    }
  }, [autoStart])

  useEffect(() => {
    if (phase !== 'running') return
    const totalSeconds = duration * 60
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1
        if (next >= totalSeconds) {
          clearInterval(interval)
          setPhase('idle')
          void onAddSessionRef.current(duration)
          onFinishedRef.current?.(duration)
          return 0
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [phase, duration])

  // Broadcast timer state to anyone interested (FocusModeEditor's topbar chip
  // is the first consumer). One global event channel per app — keeps this
  // component standalone instead of dragging state up to App. Listeners get
  // an initial snapshot when they mount via the {phase: 'idle'} dispatch on
  // unmount/idle paths below.
  useEffect(() => {
    const totalSeconds = duration * 60
    const remaining = phase === 'idle' ? totalSeconds : Math.max(0, totalSeconds - elapsed)
    window.dispatchEvent(
      new CustomEvent('scipaper:pomodoro', {
        detail: {
          phase,
          remainingSec: remaining,
          totalSec: totalSeconds,
        },
      }),
    )
  }, [phase, elapsed, duration])

  const isIdle = phase === 'idle'
  const isPaused = phase === 'paused'
  const totalSeconds = duration * 60
  const remaining = isIdle ? totalSeconds : Math.max(0, totalSeconds - elapsed)

  function pickDuration(d: number) {
    if (!isIdle) return
    setDuration(d)
    setElapsed(0)
  }

  function startTimer() {
    setElapsed(0)
    setPhase('running')
  }

  function togglePause() {
    setPhase((p) => (p === 'paused' ? 'running' : 'paused'))
  }

  function stopTimer() {
    setElapsed(0)
    setPhase('idle')
  }

  return (
    <div className={`pomo2 ${!isIdle ? 'is-running' : ''} ${isPaused ? 'is-paused' : ''}`}>
      <div className='pomo2-segs' role='radiogroup' aria-label='番茄钟时长'>
        {PRESET_DURATIONS.map((d) => {
          const selected = d === duration
          const showLive = !isIdle && selected
          return (
            <button
              key={d}
              type='button'
              role='radio'
              aria-checked={selected}
              className={`pomo2-seg${selected ? ' is-selected' : ''}${showLive ? ' is-live' : ''}`}
              onClick={() => pickDuration(d)}
              disabled={!isIdle && !selected}
            >
              <span className='pomo2-seg-time'>
                {showLive ? formatMMSS(remaining) : `${d}:00`}
              </span>
              <span className='pomo2-seg-label'>{d} min</span>
            </button>
          )
        })}
      </div>

      {isIdle ? (
        <button className='pomo2-action' type='button' onClick={startTimer}>
          <span className='pomo2-play' aria-hidden>▶</span>
          开始
        </button>
      ) : (
        <div className='pomo2-controls'>
          <button className='pomo2-control' type='button' onClick={togglePause}>
            <span className='pomo2-play' aria-hidden>{isPaused ? '▶' : '❚❚'}</span>
            {isPaused ? '继续' : '暂停'}
          </button>
          <button className='pomo2-control pomo2-control--stop' type='button' onClick={stopTimer}>
            停
          </button>
        </div>
      )}

      <span className='pomo2-tally' title='今日番茄钟'>今 {stats.todaySessions}</span>
    </div>
  )
}

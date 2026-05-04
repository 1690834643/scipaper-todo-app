import { useEffect, useMemo, useRef, useState } from 'react'

const HEALING_LINES = [
  '今天，写一段就够了。',
  '慢慢来。纸是耐心的。',
  '深呼吸，先把第一句写下来。',
  '一段好的实验，从一段平静的文字开始。',
  '写不动的时候，先看一眼窗外。',
  '允许第一稿不完美。',
  '把今天的发现，安顿成一句话。',
  '安静地写，世界会跟上来。',
  '一字一字，把数据请进文章里。',
  '今天的进度，是明天的轻松。',
]

interface SplashScreenProps {
  /** Duration in ms before auto-dismiss. Default 4200ms. */
  duration?: number
  /** Called once the splash has finished its exit animation. */
  onDone: () => void
}

export function SplashScreen({ duration = 4200, onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter')
  const tagline = useMemo(
    () => HEALING_LINES[Math.floor(Math.random() * HEALING_LINES.length)],
    [],
  )
  // 持有 mount-time timer handles 以便 skip() 时清掉，避免 onDone 在
  // skip 350ms 后又被 mount timer 在 duration ms 时再触发一次。
  const exitTimerRef = useRef<number | null>(null)
  const doneTimerRef = useRef<number | null>(null)
  const skipTimerRef = useRef<number | null>(null)
  const doneCalledRef = useRef(false)

  function callDoneOnce() {
    if (doneCalledRef.current) return
    doneCalledRef.current = true
    onDone()
  }

  useEffect(() => {
    exitTimerRef.current = window.setTimeout(() => setPhase('exit'), duration - 700)
    doneTimerRef.current = window.setTimeout(() => callDoneOnce(), duration)
    return () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
      if (doneTimerRef.current !== null) window.clearTimeout(doneTimerRef.current)
      if (skipTimerRef.current !== null) window.clearTimeout(skipTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  function skip() {
    if (phase === 'exit') return
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }
    if (doneTimerRef.current !== null) {
      window.clearTimeout(doneTimerRef.current)
      doneTimerRef.current = null
    }
    if (skipTimerRef.current !== null) {
      window.clearTimeout(skipTimerRef.current)
      skipTimerRef.current = null
    }
    setPhase('exit')
    skipTimerRef.current = window.setTimeout(() => callDoneOnce(), 350)
  }

  return (
    <div
      className={`splash-screen splash-screen--${phase}`}
      onClick={skip}
      role="presentation"
      aria-hidden
    >
      <div className="splash-aura" />
      <div className="splash-stage">
        <div className="splash-mark">
          <span className="splash-mark-letter" style={{ animationDelay: '120ms' }}>p</span>
          <span className="splash-mark-letter" style={{ animationDelay: '220ms' }}>a</span>
          <span className="splash-mark-letter" style={{ animationDelay: '320ms' }}>p</span>
          <span className="splash-mark-letter" style={{ animationDelay: '420ms' }}>e</span>
          <span className="splash-mark-letter" style={{ animationDelay: '520ms' }}>r</span>
          <span className="splash-mark-letter splash-mark-dot" style={{ animationDelay: '640ms' }}>·</span>
          <span className="splash-mark-letter" style={{ animationDelay: '740ms' }}>t</span>
          <span className="splash-mark-letter" style={{ animationDelay: '840ms' }}>o</span>
          <span className="splash-mark-letter" style={{ animationDelay: '940ms' }}>d</span>
          <span className="splash-mark-letter" style={{ animationDelay: '1040ms' }}>o</span>
        </div>
        <div className="splash-rule" />
        <p className="splash-tagline">{tagline}</p>
      </div>
      <div className="splash-breath" aria-hidden>
        <span /><span /><span />
      </div>
      <p className="splash-skip-hint">点击任意位置进入</p>
    </div>
  )
}

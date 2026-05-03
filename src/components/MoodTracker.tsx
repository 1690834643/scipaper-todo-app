import { useState } from 'react'
import type { MoodType, MoodEntry } from '../types'
import { localIsoDate } from '../utils/dateUtils'

interface MoodTrackerProps {
  moodHistory: MoodEntry[]
  onAddMood: (mood: MoodType, note?: string) => Promise<void>
  /**
   * Called immediately after a mood is recorded.
   * Used to also write a ProgressEntry kind='mood'.
   */
  onMoodRecorded?: (mood: MoodType, label: string, emoji: string, note?: string) => void
}

const MOOD_OPTIONS: { type: MoodType; emoji: string; label: string }[] = [
  { type: 'Happy', emoji: '😊', label: '开心' },
  { type: 'Calm', emoji: '😌', label: '平静' },
  { type: 'Excited', emoji: '🤩', label: '兴奋' },
  { type: 'Motivated', emoji: '🔥', label: '动力' },
  { type: 'Grateful', emoji: '🥰', label: '感恩' },
  { type: 'Tired', emoji: '😴', label: '疲惫' },
  { type: 'Sad', emoji: '😔', label: '难过' },
  { type: 'Frustrated', emoji: '😤', label: '沮丧' },
  { type: 'Anxious', emoji: '😰', label: '焦虑' },
  { type: 'Melancholy', emoji: '🌧️', label: '忧郁' },
]

export function MoodTracker({ moodHistory, onAddMood, onMoodRecorded }: MoodTrackerProps) {
  const today = localIsoDate()
  const todayMood = moodHistory.find((m) => m.date === today)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [note, setNote] = useState('')

  async function pickMood(mood: MoodType) {
    const opt = MOOD_OPTIONS.find((m) => m.type === mood)
    if (!opt) return
    await onAddMood(mood, note.trim() || undefined)
    onMoodRecorded?.(mood, opt.label, opt.emoji, note.trim() || undefined)
    setNote('')
    setPickerOpen(false)
  }

  if (todayMood && !pickerOpen) {
    const opt = MOOD_OPTIONS.find((m) => m.type === todayMood.mood)
    return (
      <button
        type='button'
        className='mood-inline mood-inline--filled'
        onClick={() => setPickerOpen(true)}
        title='点击换一个心情'
      >
        <span className='mood-inline-emoji'>{opt?.emoji}</span>
        <span className='mood-inline-label'>{opt?.label}</span>
        {todayMood.note ? <span className='mood-inline-note'>· {todayMood.note}</span> : null}
      </button>
    )
  }

  if (!pickerOpen) {
    return (
      <button
        type='button'
        className='mood-inline mood-inline--empty'
        onClick={() => setPickerOpen(true)}
      >
        <span className='mood-inline-emoji'>＋</span>
        <span className='mood-inline-label'>记一下心情</span>
      </button>
    )
  }

  return (
    <div className='mood-inline-picker'>
      <div className='mood-inline-chips'>
        {MOOD_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type='button'
            className='mood-inline-chip'
            onClick={() => void pickMood(opt.type)}
            title={opt.label}
          >
            <span className='mood-inline-chip-emoji'>{opt.emoji}</span>
            <span className='mood-inline-chip-label'>{opt.label}</span>
          </button>
        ))}
      </div>
      <input
        className='mood-inline-note-input'
        type='text'
        placeholder='给心情加一句话（可选）'
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        type='button'
        className='mood-inline-cancel'
        onClick={() => {
          setPickerOpen(false)
          setNote('')
        }}
      >
        取消
      </button>
    </div>
  )
}

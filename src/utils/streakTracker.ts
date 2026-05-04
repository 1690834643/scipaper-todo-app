// src/utils/streakTracker.ts

import type { WritingStreak } from '../types'
import { localIsoDate } from './dateUtils'

export function calculateStreak(
  streakHistory: WritingStreak['streakHistory'],
  dailyGoal: number
): {
  currentStreak: number
  longestStreak: number
  totalWritingDays: number
} {
  if (!streakHistory || streakHistory.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalWritingDays: 0 }
  }
  
  // Sort by date descending
  const sorted = [...streakHistory].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  let totalWritingDays = 0
  
  const today = localIsoDate()
  const yesterday = localIsoDate(new Date(Date.now() - 86400000))
  
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    
    if (entry.words > 0) {
      totalWritingDays++
    }
    
    // Check if goal was met
    if (entry.words >= dailyGoal) {
      if (i === 0 && (entry.date === today || entry.date === yesterday)) {
        // Current streak starts from today or yesterday
        currentStreak = 1
        tempStreak = 1
      } else if (tempStreak > 0) {
        // Check if consecutive days
        const prevDate = new Date(sorted[i - 1].date)
        const currDate = new Date(entry.date)
        const diffDays = Math.floor(
          (prevDate.getTime() - currDate.getTime()) / 86400000
        )
        
        if (diffDays === 1) {
          tempStreak++
          currentStreak = tempStreak
        } else {
          tempStreak = 1
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak)
    } else {
      tempStreak = 0
    }
  }
  
  return { currentStreak, longestStreak, totalWritingDays }
}

export function getHeatmapData(
  streakHistory: WritingStreak['streakHistory'],
  days: number = 28
): { date: string; words: number; level: number }[] {
  const today = new Date()
  const window: { date: string; words: number }[] = []

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86400000)
    const dateStr = localIsoDate(date)
    const entry = streakHistory.find(h => h.date === dateStr)
    window.push({ date: dateStr, words: entry?.words || 0 })
  }

  const nonZero = window.map(d => d.words).filter(w => w > 0).sort((a, b) => a - b)

  function quantile(arr: number[], q: number) {
    if (arr.length === 0) return 0
    const pos = (arr.length - 1) * q
    const base = Math.floor(pos)
    const rest = pos - base
    if (base + 1 < arr.length) {
      return arr[base] + rest * (arr[base + 1] - arr[base])
    }
    return arr[base]
  }

  // Need at least 4 active days for percentile-based bucketing; otherwise
  // fall back to fixed thresholds so a single high-output day stands out.
  const usePercentile = nonZero.length >= 4
  const t1 = usePercentile ? quantile(nonZero, 0.25) : 1
  const t2 = usePercentile ? quantile(nonZero, 0.5) : 500
  const t3 = usePercentile ? quantile(nonZero, 0.75) : 1500

  return window.map(({ date, words }) => {
    let level = 0
    if (words > 0) level = 1
    if (words > t1) level = 2
    if (words > t2) level = 3
    if (words > t3) level = 4
    return { date, words, level }
  })
}

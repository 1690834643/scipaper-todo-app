// =============================================================================
// FocusOutlineRail — floating right-margin rail with H2 ticks.
//
// Walks the TipTap doc on every update and emits one tick per top-level H2
// (level-3 headings stay implicit so the rail doesn't crowd). Hover reveals
// the label, click scrolls the heading into view, and a scroll listener keeps
// `is-active` synced to the heading currently nearest the viewport top.
//
// Visual styling — see .focus-mode-outline-rail in focus-mode.css.
// =============================================================================

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Editor } from '@tiptap/react'

interface OutlineEntry {
  index: number
  label: string
  pos: number
}

interface FocusOutlineRailProps {
  editor: Editor | null
  /** The scroll container (canvas <main>). Used both for scroll listening and
   *  to find rendered <h2> elements via querySelectorAll. */
  canvasRef: RefObject<HTMLElement | null>
}

function collectH2(editor: Editor): OutlineEntry[] {
  const out: OutlineEntry[] = []
  let index = 0
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading' && node.attrs.level === 2) {
      const text = (node.textContent || '').trim()
      out.push({
        index: index++,
        label: text || '（无标题）',
        pos,
      })
      return false
    }
    return true
  })
  return out
}

function sameOutlineEntries(a: OutlineEntry[], b: OutlineEntry[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].index !== b[i].index || a[i].pos !== b[i].pos || a[i].label !== b[i].label) {
      return false
    }
  }
  return true
}

export function FocusOutlineRail({ editor, canvasRef }: FocusOutlineRailProps) {
  const [entries, setEntries] = useState<OutlineEntry[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const entriesRef = useRef<OutlineEntry[]>([])
  const activeIndexRef = useRef(-1)
  const outlineFrameRef = useRef<number | null>(null)
  const scrollFrameRef = useRef<number | null>(null)

  // Re-collect H2s whenever the editor updates. Subscribe via TipTap's
  // 'update' / 'create' events so the list tracks live typing.
  useEffect(() => {
    if (!editor) return
    const recomputeNow = () => {
      outlineFrameRef.current = null
      const next = collectH2(editor)
      if (sameOutlineEntries(entriesRef.current, next)) return
      entriesRef.current = next
      setEntries(next)
    }
    const recompute = () => {
      if (outlineFrameRef.current !== null) return
      outlineFrameRef.current = window.requestAnimationFrame(recomputeNow)
    }
    recomputeNow()
    editor.on('update', recompute)
    editor.on('create', recompute)
    return () => {
      editor.off('update', recompute)
      editor.off('create', recompute)
      if (outlineFrameRef.current !== null) {
        window.cancelAnimationFrame(outlineFrameRef.current)
        outlineFrameRef.current = null
      }
    }
  }, [editor])

  // Active-tick tracking: on canvas scroll, find the H2 whose top is closest
  // to the canvas' top edge (within ±200px). Active = that one's index.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const compute = () => {
      scrollFrameRef.current = null
      const headings = canvas.querySelectorAll<HTMLElement>('.focus-mode-prose h2')
      if (headings.length === 0) {
        if (activeIndexRef.current !== -1) {
          activeIndexRef.current = -1
          setActiveIndex(-1)
        }
        return
      }
      const canvasTop = canvas.getBoundingClientRect().top
      let bestIdx = 0
      let bestDist = Number.POSITIVE_INFINITY
      headings.forEach((h, i) => {
        const top = h.getBoundingClientRect().top - canvasTop
        // Prefer the heading just above (or at) the viewport top.
        const dist = top <= 80 ? Math.abs(top - 40) : Number.POSITIVE_INFINITY
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      })
      if (activeIndexRef.current !== bestIdx) {
        activeIndexRef.current = bestIdx
        setActiveIndex(bestIdx)
      }
    }
    const scheduleCompute = () => {
      if (scrollFrameRef.current !== null) return
      scrollFrameRef.current = window.requestAnimationFrame(compute)
    }
    compute()
    canvas.addEventListener('scroll', scheduleCompute, { passive: true })
    return () => {
      canvas.removeEventListener('scroll', scheduleCompute)
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = null
      }
    }
  }, [canvasRef, entries.length])

  const ticks = entries

  if (!editor || ticks.length === 0) return null

  function jumpTo(entry: OutlineEntry) {
    if (!editor || !canvasRef.current) return
    // ProseMirror coords: nodeAt(pos) gives us the heading. Use TipTap's
    // chain to focus + place cursor; then scrollIntoView on the rendered DOM
    // node (PM doesn't expose a smooth scroll directly).
    editor.chain().focus().setTextSelection(entry.pos + 1).run()
    const headings = canvasRef.current.querySelectorAll<HTMLElement>('.focus-mode-prose h2')
    const target = headings[entry.index]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav className="focus-mode-outline-rail" aria-label="章节大纲">
      {ticks.map((entry) => (
        <button
          key={`${entry.index}:${entry.pos}`}
          type="button"
          className={`focus-mode-outline-tick${activeIndex === entry.index ? ' is-active' : ''}`}
          onClick={() => jumpTo(entry)}
          title={entry.label}
        >
          <span className="focus-mode-outline-tick-label">{entry.label}</span>
        </button>
      ))}
    </nav>
  )
}

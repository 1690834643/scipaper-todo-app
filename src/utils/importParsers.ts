import type { ReviewCommentType, SectionType } from '../types'

export interface ParsedManuscriptSection {
  sectionType: SectionType
  title: string
  content: string
}

export interface ParsedReviewComment {
  originalText: string
  type: ReviewCommentType
  suggestedSection: string
}

export interface ParsedReviewerGroup {
  reviewerId: string
  comments: ParsedReviewComment[]
}

const SECTION_ALIASES: Array<{ sectionType: SectionType; patterns: RegExp[]; title: string }> = [
  { sectionType: 'Title', title: 'Title', patterns: [/^title$/i, /^题目$/] },
  { sectionType: 'Abstract', title: 'Abstract', patterns: [/^abstract$/i, /^摘要$/] },
  { sectionType: 'Introduction', title: 'Introduction', patterns: [/^introduction$/i, /^引言$/, /^前言$/] },
  {
    sectionType: 'MaterialsAndMethods',
    title: 'Materials and Methods',
    patterns: [/^materials?\s+and\s+methods?$/i, /^methods?$/i, /^方法$/, /^材料与方法$/],
  },
  { sectionType: 'Results', title: 'Results', patterns: [/^results?$/i, /^结果$/] },
  { sectionType: 'Discussion', title: 'Discussion', patterns: [/^discussion$/i, /^讨论$/] },
  { sectionType: 'References', title: 'References', patterns: [/^references?$/i, /^参考文献$/] },
]

function cleanLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim())
}

function normalizeHeading(line: string): string {
  return line.replace(/^#+\s*/, '').replace(/^\d+(\.\d+)*[.)]?\s*/, '').replace(/[:：]\s*$/, '').trim()
}

function matchSection(line: string) {
  const heading = normalizeHeading(line)
  return SECTION_ALIASES.find((entry) => entry.patterns.some((pattern) => pattern.test(heading)))
}

export function parseManuscriptDraft(text: string): ParsedManuscriptSection[] {
  const lines = cleanLines(text)
  const sections: ParsedManuscriptSection[] = []
  let current: { sectionType: SectionType; title: string; lines: string[] } | null = null

  for (const line of lines) {
    const matched = matchSection(line)
    if (matched) {
      if (current) {
        const content = current.lines.join('\n').trim()
        if (content) sections.push({ sectionType: current.sectionType, title: current.title, content })
      }
      current = { sectionType: matched.sectionType, title: matched.title, lines: [] }
      continue
    }

    if (current) current.lines.push(line)
  }

  if (current) {
    const content = current.lines.join('\n').trim()
    if (content) sections.push({ sectionType: current.sectionType, title: current.title, content })
  }

  return sections
}

function parseReviewerHeading(line: string): string | null {
  const normalized = normalizeHeading(line)
  const reviewerMatch = normalized.match(/^(reviewer|referee)\s*#?\s*(\d+|[A-Za-z]+)$/i)
  if (reviewerMatch) return `Reviewer ${reviewerMatch[2]}`
  const editorMatch = normalized.match(/^editor/i)
  if (editorMatch) return 'Editor'
  const chineseMatch = normalized.match(/^审稿人\s*#?\s*(\d+|[A-Za-z]+)$/)
  if (chineseMatch) return `Reviewer ${chineseMatch[1]}`
  return null
}

function startsComment(line: string): boolean {
  return /^(major|minor)?\s*(comment\s*)?\d+[.)：:]?\s+/i.test(line)
    || /^(major|minor)\s+comment\s+\d+[：:]?\s*/i.test(line)
    || /^[-*]\s+/.test(line)
}

function normalizeCommentStart(line: string): string {
  const withoutBullet = line.replace(/^[-*]\s+/, '').trim()
  const typed = withoutBullet.match(/^(major|minor)\s+comment\s+\d+[：:]?\s*(.*)$/i)
  if (typed) return `${typed[1]} comment: ${typed[2] || ''}`.trim()
  return withoutBullet.replace(/^(comment\s*)?\d+[.)：:]?\s*/i, '').trim()
}

function inferCommentType(text: string): ReviewCommentType {
  return /\bminor\b|小修|次要/i.test(text) ? 'Minor' : 'Major'
}

function inferSuggestedSection(text: string): string {
  const matched = SECTION_ALIASES.find((entry) => entry.sectionType !== 'Title' && entry.patterns.some((pattern) => pattern.test(text)))
  return matched?.sectionType ?? ''
}

function pushComment(target: ParsedReviewComment[], rawLines: string[]) {
  const originalText = rawLines.join('\n').trim()
  if (!originalText) return
  target.push({
    originalText,
    type: inferCommentType(originalText),
    suggestedSection: inferSuggestedSection(originalText),
  })
}

export function parseReviewLetter(text: string): ParsedReviewerGroup[] {
  const groups: ParsedReviewerGroup[] = []
  let currentGroup: ParsedReviewerGroup | null = null
  let currentCommentLines: string[] = []

  for (const line of cleanLines(text)) {
    if (!line) continue

    const reviewerId = parseReviewerHeading(line)
    if (reviewerId) {
      if (currentGroup) pushComment(currentGroup.comments, currentCommentLines)
      currentCommentLines = []
      currentGroup = { reviewerId, comments: [] }
      groups.push(currentGroup)
      continue
    }

    if (!currentGroup) {
      currentGroup = { reviewerId: 'Reviewer 1', comments: [] }
      groups.push(currentGroup)
    }

    if (startsComment(line)) {
      pushComment(currentGroup.comments, currentCommentLines)
      currentCommentLines = [normalizeCommentStart(line)]
    } else {
      currentCommentLines.push(line)
    }
  }

  if (currentGroup) pushComment(currentGroup.comments, currentCommentLines)

  return groups.filter((group) => group.comments.length > 0)
}

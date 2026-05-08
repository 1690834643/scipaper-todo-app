import type { SectionType } from '../types'
import type { ImportDocumentBlock, ParseMarkdownImportOptions } from './importDocument'

const SECTION_ALIASES: Array<{ sectionType: SectionType; patterns: RegExp[]; title: string }> = [
  { sectionType: 'Title', title: 'Title', patterns: [/^title$/i, /^标题$/, /^题目$/] },
  { sectionType: 'Abstract', title: 'Abstract', patterns: [/^abstract$/i, /^摘要$/] },
  { sectionType: 'Introduction', title: 'Introduction', patterns: [/^introduction$/i, /^引言$/, /^前言$/, /^绪论$/] },
  {
    sectionType: 'MaterialsAndMethods',
    title: 'Materials and Methods',
    patterns: [/^materials?\s+and\s+methods?$/i, /^methods?$/i, /^方法$/, /^材料与方法$/, /^材料和方法$/],
  },
  { sectionType: 'Results', title: 'Results', patterns: [/^results?$/i, /^结果$/] },
  { sectionType: 'Discussion', title: 'Discussion', patterns: [/^discussion$/i, /^讨论$/] },
  { sectionType: 'References', title: 'References', patterns: [/^references?$/i, /^参考文献$/] },
]

function normalizeHeading(line: string): string {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^\d+(\.\d+)*[.)]?\s*/, '')
    .replace(/(?<=[\u4e00-\u9fa5])\s*(?:[IVXLCDM]+|\d+)$/i, '')
    .replace(/[:：]\s*$/, '')
    .trim()
}

function matchSection(line: string) {
  const heading = normalizeHeading(line)
  return SECTION_ALIASES.find((entry) => entry.patterns.some((pattern) => pattern.test(heading)))
}

function cleanContent(lines: string[]): string {
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function makeId(prefix: string, index: number): string {
  return `${prefix}-${index}`
}

function parseRoundTripBlocks(text: string, sourceName: string): ImportDocumentBlock[] {
  const blocks: ImportDocumentBlock[] = []
  const sectionRegex = /<!--\s*scipaper:section\s+([A-Za-z]+)\s*-->([\s\S]*?)<!--\s*\/scipaper:section\s*-->/g
  let sectionMatch: RegExpExecArray | null

  while ((sectionMatch = sectionRegex.exec(text)) !== null) {
    const sectionType = sectionMatch[1] as SectionType
    if (!SECTION_ALIASES.some((entry) => entry.sectionType === sectionType)) continue

    const body = sectionMatch[2] || ''
    const blockRegex = /<!--\s*scipaper:block\s+text(?:\s+blockId=([^\s]+))?(?:\s+title="([^"]*)")?\s*-->([\s\S]*?)<!--\s*\/scipaper:block\s*-->/g
    let blockMatch: RegExpExecArray | null
    while ((blockMatch = blockRegex.exec(body)) !== null) {
      const content = blockMatch[3].trim()
      if (!content) continue
      blocks.push({
        id: makeId('roundtrip', blocks.length),
        sectionType,
        title: blockMatch[2] || sectionType,
        content,
        sourceName,
        sourceBlockId: blockMatch[1],
      })
    }
  }

  return blocks
}

export function parseMarkdownManuscript(text: string, options: ParseMarkdownImportOptions): ImportDocumentBlock[] {
  const sourceName = options.sourceName || ''
  const roundTripBlocks = parseRoundTripBlocks(text, sourceName)
  if (roundTripBlocks.length > 0) return roundTripBlocks

  const normalized = text.replace(/\r\n?/g, '\n')
  if (options.strategy === 'single') {
    const content = normalized.trim()
    return content
      ? [{
          id: 'single-0',
          sectionType: options.targetSection || 'Introduction',
          title: options.targetSection || 'Introduction',
          content,
          sourceName,
        }]
      : []
  }

  const lines = normalized.split('\n')
  const blocks: ImportDocumentBlock[] = []
  let current: { sectionType: SectionType; title: string; lines: string[] } | null = null
  let subheading: { title: string; lines: string[] } | null = null

  function pushSubheading() {
    if (!current || !subheading) return
    const content = cleanContent(subheading.lines)
    if (content) {
      blocks.push({
        id: makeId('heading', blocks.length),
        sectionType: current.sectionType,
        title: subheading.title,
        content,
        sourceName,
      })
    }
    subheading = null
  }

  function pushCurrentSectionLines() {
    if (!current) return
    const content = cleanContent(current.lines)
    if (content) {
      blocks.push({
        id: makeId('section', blocks.length),
        sectionType: current.sectionType,
        title: current.title,
        content,
        sourceName,
      })
    }
    current.lines = []
  }

  function pushSection() {
    if (!current) return
    if (options.strategy === 'heading') pushSubheading()
    pushCurrentSectionLines()
    current = null
  }

  for (const rawLine of lines) {
    const matched = matchSection(rawLine.trim())
    if (matched) {
      pushSection()
      current = { sectionType: matched.sectionType, title: matched.title, lines: [] }
      subheading = null
      continue
    }

    if (!current) continue

    const subheadingMatch = rawLine.match(/^#{3,6}\s+(.+?)\s*$/)
    if (options.strategy === 'heading' && subheadingMatch) {
      pushSubheading()
      pushCurrentSectionLines()
      subheading = { title: subheadingMatch[1].trim(), lines: [] }
      continue
    }

    if (subheading) subheading.lines.push(rawLine)
    else current.lines.push(rawLine)
  }

  pushSection()
  return blocks
}

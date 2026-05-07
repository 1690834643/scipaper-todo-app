import { describe, expect, it } from 'vitest'
import { parseManuscriptDraft, parseReviewLetter } from '../src/utils/importParsers'

describe('import parsers', () => {
  it('splits a partially written manuscript into known article sections', () => {
    const parsed = parseManuscriptDraft(`
Title
Mitochondrial stress rewires piRNA response

Abstract
We found a stress-linked small RNA response.

Introduction
Small RNA pathways respond to environmental changes.

Materials and Methods
Animals were cultured at 20 C.

Results
Stress increased piRNA reporter signal.

Discussion
These data suggest a protective response.
`)

    expect(parsed.map((section) => section.sectionType)).toEqual([
      'Title',
      'Abstract',
      'Introduction',
      'MaterialsAndMethods',
      'Results',
      'Discussion',
    ])
    expect(parsed[0]?.content).toBe('Mitochondrial stress rewires piRNA response')
    expect(parsed.find((section) => section.sectionType === 'MaterialsAndMethods')?.content).toContain('Animals')
  })

  it('groups review-letter comments by reviewer and preserves multiple comments per reviewer', () => {
    const parsed = parseReviewLetter(`
Reviewer 1
Major comment 1: The introduction lacks a clear gap statement.
2. Please explain why the stress condition was selected.

Reviewer #2:
Minor comment 1: Figure 2 needs a clearer legend.
Comment 2: The discussion should mention limitations.
`)

    expect(parsed).toHaveLength(2)
    expect(parsed[0]?.reviewerId).toBe('Reviewer 1')
    expect(parsed[0]?.comments).toHaveLength(2)
    expect(parsed[0]?.comments[0]?.type).toBe('Major')
    expect(parsed[1]?.reviewerId).toBe('Reviewer 2')
    expect(parsed[1]?.comments).toHaveLength(2)
    expect(parsed[1]?.comments[0]?.type).toBe('Minor')
  })

  it('recognizes Chinese thesis-style headings after AI or docx cleanup', () => {
    const parsed = parseManuscriptDraft(`
摘要
这是摘要正文。

1. 绪论
研究背景内容。

2.1 材料与方法
供试昆虫与样品收集。

3 结果
主要结果内容。

4. 讨论
讨论内容。
`)

    expect(parsed.map((section) => section.sectionType)).toEqual([
      'Abstract',
      'Introduction',
      'MaterialsAndMethods',
      'Results',
      'Discussion',
    ])
    expect(parsed.find((section) => section.sectionType === 'Introduction')?.content).toContain('研究背景内容')
    expect(parsed.find((section) => section.sectionType === 'MaterialsAndMethods')?.content).toContain('供试昆虫')
  })
})

import { describe, expect, it } from 'vitest'
import { parseManuscriptDraft, parseReviewLetter } from '../src/utils/importParsers'
import { parseMarkdownManuscript } from '../src/utils/markdownImportParser'

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

  it('imports a markdown Results section as one block by default', () => {
    const parsed = parseMarkdownManuscript(`
# Draft

## 结果

Result paragraph one.

### Screening

Result paragraph two.
`, { strategy: 'section', sourceName: 'results.md' })

    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.sectionType).toBe('Results')
    expect(parsed[0]?.content).toContain('Result paragraph one.')
    expect(parsed[0]?.content).toContain('### Screening')
    expect(parsed[0]?.sourceName).toBe('results.md')
  })

  it('can split markdown section content by subheading when requested', () => {
    const parsed = parseMarkdownManuscript(`
## Results

Opening result.

### Screening

Screening text.

### Functional validation

Functional text.
`, { strategy: 'heading', sourceName: 'results.md' })

    expect(parsed.map((block) => block.sectionType)).toEqual(['Results', 'Results', 'Results'])
    expect(parsed.map((block) => block.title)).toEqual(['Results', 'Screening', 'Functional validation'])
    expect(parsed[1]?.content).toBe('Screening text.')
  })

  it('can import a whole markdown file into one selected section', () => {
    const parsed = parseMarkdownManuscript(`
# Notes

This is a free-form file.
`, { strategy: 'single', targetSection: 'Discussion', sourceName: 'notes.md' })

    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.sectionType).toBe('Discussion')
    expect(parsed[0]?.content).toContain('This is a free-form file.')
  })

  it('preserves reimportable markdown block boundaries', () => {
    const parsed = parseMarkdownManuscript(`
<!-- scipaper:section Results -->
<!-- scipaper:block text blockId=old-a title="First result" -->
First block.
<!-- /scipaper:block -->
<!-- scipaper:block text blockId=old-b title="Second result" -->
Second block.
<!-- /scipaper:block -->
<!-- /scipaper:section -->
`, { strategy: 'section', sourceName: 'roundtrip.md' })

    expect(parsed).toHaveLength(2)
    expect(parsed.map((block) => block.sourceBlockId)).toEqual(['old-a', 'old-b'])
    expect(parsed.map((block) => block.content)).toEqual(['First block.', 'Second block.'])
  })
})

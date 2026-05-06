import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { validateArgs } = require('../electron/toolRouter.cjs')

describe('toolRouter section validation', () => {
  it('rejects section types that storage does not support', () => {
    const result = validateArgs('add_text_block', {
      articleId: 'article-1',
      sectionType: 'Figures',
      content: 'Figure legend text',
    })

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('invalid enum for sectionType')
  })

  it('accepts storage-backed section types', () => {
    const result = validateArgs('add_text_block', {
      articleId: 'article-1',
      sectionType: 'Results',
      content: 'Results text',
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('accepts AI thesis section writing tool arguments', () => {
    const result = validateArgs('add_thesis_text_block', {
      thesisId: 'thesis-1',
      sectionId: 'section-1',
      content: 'Thesis chapter text',
      description: 'draft chapter',
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('accepts AI thesis export tool arguments', () => {
    const result = validateArgs('export_thesis', {
      thesisId: 'thesis-1',
      format: 'markdown',
    })

    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('accepts AI citation update and delete tool arguments', () => {
    expect(
      validateArgs('update_citation', {
        articleId: 'article-1',
        citationId: 'citation-1',
        patch: { title: 'Corrected citation' },
      }),
    ).toEqual({ valid: true, errors: [] })

    expect(
      validateArgs('delete_citation', {
        articleId: 'article-1',
        citationId: 'citation-1',
      }),
    ).toEqual({ valid: true, errors: [] })
  })
})

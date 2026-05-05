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
})

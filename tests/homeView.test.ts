import { describe, expect, it } from 'vitest'
import type { Article } from '../src/types'
import { articleExcerpt } from '../src/utils/articleExcerpt'

function articleWithContent(content: string): Article {
  return {
    id: 'article-1',
    title: 'Demo article',
    targetJournal: 'Demo Journal',
    status: 'Drafting',
    language: 'en',
    createdAt: '2026-05-08T00:00:00.000Z',
    updatedAt: '2026-05-08T00:00:00.000Z',
    researchContext: {
      id: 'ctx-1',
      articleId: 'article-1',
      scientificQuestion: '',
      observedPhenomenon: '',
      hypothesis: '',
      approach: '',
      createdAt: '2026-05-08T00:00:00.000Z',
      updatedAt: '2026-05-08T00:00:00.000Z',
    },
    sections: [
      {
        id: 'section-1',
        type: 'Introduction',
        orderIndex: 0,
        contentBlocks: [
          {
            id: 'block-1',
            sectionId: 'section-1',
            type: 'Text',
            content,
            description: 'Intro block',
            orderIndex: 0,
            createdAt: '2026-05-08T00:00:00.000Z',
            updatedAt: '2026-05-08T00:00:00.000Z',
            versions: [],
          },
        ],
      },
    ],
    reviewRounds: [],
    citations: [],
    tags: [],
  }
}

describe('HomeView article excerpt', () => {
  it('shows stored rich-text blocks as plain text', () => {
    const excerpt = articleExcerpt(articleWithContent('<h2>Stress memory</h2><p>ABA pulse recovery remains reversible.</p>'))

    expect(excerpt).toBe('Stress memory ABA pulse recovery remains reversible.')
  })
})

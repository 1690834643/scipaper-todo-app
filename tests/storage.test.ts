import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const storagePath = require.resolve('../electron/storage.cjs')

type StorageModule = typeof import('../electron/storage.cjs')

let tempHomes: string[] = []

function loadStorage(home: string): StorageModule {
  process.env.HOME = home
  delete require.cache[storagePath]
  return require('../electron/storage.cjs') as StorageModule
}

function makeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'scipaper-storage-'))
  tempHomes.push(home)
  return home
}

function createSmokeArticle(storage: StorageModule) {
  return storage.createArticle({
    title: 'Smoke article',
    targetJournal: 'Journal',
    researchContext: {
      scientificQuestion: 'Question',
      observedPhenomenon: 'Phenomenon',
      hypothesis: 'Hypothesis',
      approach: 'Approach',
    },
  })
}

function firstBlock(storage: StorageModule, articleId: string, sectionType = 'Results') {
  const state = storage.loadState()
  const article = state.articles.find((item) => item.id === articleId)
  const section = article?.sections.find((item) => item.type === sectionType)
  return section?.contentBlocks[0]
}

beforeEach(() => {
  tempHomes = []
})

afterEach(() => {
  delete require.cache[storagePath]
  for (const home of tempHomes) {
    fs.rmSync(home, { force: true, recursive: true })
  }
})

describe('storage writing streaks', () => {
  it('persists text edits and added words in the same mutation', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.addTextBlock(article.id, 'Results', 'one', 'initial')
    const block = firstBlock(storage, article.id)

    expect(block).toBeDefined()
    storage.updateTextBlockWithStreak(article.id, block!.id, 'one two three', 'expanded')

    const state = storage.loadState()
    const updatedBlock = firstBlock(storage, article.id)

    expect(updatedBlock?.content).toBe('one two three')
    expect(state.writingStreak.todayWords).toBe(2)
    expect(state.writingStreak.currentStreak).toBe(1)
    expect(state.writingStreak.streakHistory[0]?.words).toBe(2)
  })

  it('repairs legacy partial writing streak records before updates', () => {
    const storage = loadStorage(makeHome())
    fs.mkdirSync(path.dirname(storage.DATABASE_PATH), { recursive: true })
    fs.writeFileSync(
      storage.DATABASE_PATH,
      JSON.stringify({
        version: 1,
        articles: [],
        writingStreak: {
          currentStreak: 0,
          longestStreak: 0,
          lastWriteDate: null,
          totalWritingDays: 0,
          todayWords: 0,
        },
      }),
      'utf-8',
    )

    const article = createSmokeArticle(storage)
    storage.addTextBlock(article.id, 'Results', 'alpha', 'initial')
    const block = firstBlock(storage, article.id)

    expect(() => storage.updateTextBlockWithStreak(article.id, block!.id, 'alpha beta', 'expanded')).not.toThrow()

    const state = storage.loadState()
    expect(state.writingStreak.dailyGoal).toBe(500)
    expect(state.writingStreak.todayWords).toBe(1)
    expect(state.writingStreak.streakHistory[0]?.words).toBe(1)
  })
})

describe('storage derived data', () => {
  it('uses mixed Chinese and English word counting for writing stats', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.addTextBlock(article.id, 'Results', '科研写作 test', 'mixed language')

    expect(storage.getWritingStats().totalWords).toBe(5)
  })

  it('creates thesis sections with stable thesis ids and titles', () => {
    const storage = loadStorage(makeHome())
    const thesis = storage.createThesis({
      title: 'Thesis',
      titleEn: 'Thesis',
      author: 'Author',
      supervisor: 'Supervisor',
      institution: 'Institution',
      department: 'Department',
      degree: 'Master',
      abstractZh: '',
      abstractEn: '',
      keywords: [],
    })

    expect(thesis.sections.length).toBeGreaterThan(0)
    expect(thesis.sections.every((section) => section.thesisId === thesis.id)).toBe(true)
    expect(thesis.sections.every((section) => section.title.length > 0)).toBe(true)
  })
})

describe('storage database recovery', () => {
  it('recovers from a corrupt primary database when a valid backup exists', () => {
    const storage = loadStorage(makeHome())
    fs.mkdirSync(path.dirname(storage.DATABASE_PATH), { recursive: true })

    const backup = {
      version: 1,
      articles: [
        {
          id: 'article-from-backup',
          title: 'Recovered article',
          targetJournal: 'Journal',
          status: 'Drafting',
          createdAt: '2026-05-05T00:00:00.000Z',
          updatedAt: '2026-05-05T00:00:00.000Z',
          researchContext: {
            id: 'rc-1',
            articleId: 'article-from-backup',
            scientificQuestion: 'Question',
            observedPhenomenon: 'Phenomenon',
            hypothesis: 'Hypothesis',
            approach: 'Approach',
            createdAt: '2026-05-05T00:00:00.000Z',
            updatedAt: '2026-05-05T00:00:00.000Z',
          },
          sections: [],
          reviewRounds: [],
          citations: [],
        },
      ],
      theses: [],
      writingStreak: {
        currentStreak: 0,
        longestStreak: 0,
        lastWriteDate: null,
        totalWritingDays: 0,
        todayWords: 0,
      },
    }

    fs.writeFileSync(storage.DATABASE_PATH + '.bak', JSON.stringify(backup), 'utf-8')
    fs.writeFileSync(storage.DATABASE_PATH, '{ not valid json', 'utf-8')

    const state = storage.loadState()

    expect(state.articles[0]?.id).toBe('article-from-backup')
    expect(fs.readFileSync(storage.DATABASE_PATH, 'utf-8')).toBe(JSON.stringify(backup))
  })
})

describe('storage LLM providers', () => {
  it('persists maxTokens for default, added, and updated providers', () => {
    const storage = loadStorage(makeHome())

    const initial = storage.listProviders()
    const defaultProvider = initial.providers.find((provider) => provider.id === 'deepseek-v4-flash')

    expect(defaultProvider?.maxTokens).toBe(384000)

    const added = storage.addProvider({
      name: 'Local OpenAI',
      kind: 'openai-compat',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'local-model',
      supportsToolUse: true,
      maxTokens: 12345,
    })

    expect(added.maxTokens).toBe(12345)
    expect(storage.listProviders().providers.find((provider) => provider.id === added.id)?.maxTokens).toBe(12345)

    const updated = storage.updateProvider(added.id, { maxTokens: 67890 })

    expect(updated.maxTokens).toBe(67890)
    expect(storage.listProviders().providers.find((provider) => provider.id === added.id)?.maxTokens).toBe(67890)
  })
})

describe('storage import workflows', () => {
  it('imports parsed manuscript sections as text blocks', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.importManuscriptSections(article.id, [
      { sectionType: 'Abstract', content: 'Imported abstract text.' },
      { sectionType: 'Results', content: 'Imported result text.' },
    ])

    const imported = storage.loadState().articles.find((item) => item.id === article.id)
    expect(imported?.sections.find((section) => section.type === 'Abstract')?.contentBlocks[0]?.content).toBe(
      'Imported abstract text.',
    )
    expect(imported?.sections.find((section) => section.type === 'Results')?.contentBlocks[0]?.description).toBe(
      'Imported manuscript draft',
    )
  })

  it('imports grouped reviewer comments into a review round', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.importReviewComments(article.id, {
      submittedAt: '2026-05-05',
      journalName: 'Journal',
      manuscriptNumber: 'MS-1',
      groups: [
        {
          reviewerId: 'Reviewer 1',
          comments: [
            { originalText: 'Please clarify the hypothesis.', type: 'Major', suggestedSection: 'Introduction' },
            { originalText: 'Fix the Figure 2 legend.', type: 'Minor', suggestedSection: 'Results' },
          ],
        },
        {
          reviewerId: 'Reviewer 2',
          comments: [
            { originalText: 'Discuss the limitation.', type: 'Major', suggestedSection: 'Discussion' },
          ],
        },
      ],
    })

    const imported = storage.loadState().articles.find((item) => item.id === article.id)
    const round = imported?.reviewRounds[0]

    expect(round?.comments).toHaveLength(3)
    expect(round?.comments.filter((comment) => comment.reviewerId === 'Reviewer 1')).toHaveLength(2)
    expect(round?.comments.map((comment) => comment.originalText)).toContain('Discuss the limitation.')
    expect(imported?.status).toBe('UnderReview')
  })

  it('can undo the most recent import batch', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.importManuscriptSections(article.id, [
      { sectionType: 'Results', content: 'Imported result text.' },
    ])
    storage.importReviewComments(article.id, {
      groups: [
        {
          reviewerId: 'Reviewer 1',
          comments: [{ originalText: 'Please clarify.', type: 'Major', suggestedSection: 'Results' }],
        },
      ],
    })

    storage.undoLastImportBatch(article.id)
    let imported = storage.loadState().articles.find((item) => item.id === article.id)
    expect(imported?.reviewRounds).toHaveLength(0)
    expect(imported?.sections.find((section) => section.type === 'Results')?.contentBlocks).toHaveLength(1)

    storage.undoLastImportBatch(article.id)
    imported = storage.loadState().articles.find((item) => item.id === article.id)
    expect(imported?.sections.find((section) => section.type === 'Results')?.contentBlocks).toHaveLength(0)
  })

  it('allows unassigned daily progress entries', () => {
    const storage = loadStorage(makeHome())

    storage.addProgressEntry({
      articleId: '',
      kind: 'idea',
      title: 'Unassigned idea',
    })

    const entry = storage.loadState().progressEntries[0]
    expect(entry.articleId).toBe('')
    expect(entry.title).toBe('Unassigned idea')
  })
})

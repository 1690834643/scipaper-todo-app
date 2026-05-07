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
  process.env.USERPROFILE = home
  const parsed = path.parse(home)
  process.env.HOMEDRIVE = parsed.root.replace(/[\\/]+$/, '')
  process.env.HOMEPATH = home.slice(process.env.HOMEDRIVE.length) || '\\'
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
  delete process.env.HOME
  delete process.env.USERPROFILE
  delete process.env.HOMEDRIVE
  delete process.env.HOMEPATH
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

  it('deletes thesis records without deleting linked articles', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)
    const thesis = storage.createThesis({
      title: 'Thesis to delete',
      titleEn: '',
      author: 'Author',
      supervisor: '',
      institution: '',
      department: '',
      degree: 'Master',
      abstractZh: '',
      abstractEn: '',
      keywords: [],
    })

    storage.linkArticleToThesis(thesis.id, article.id)
    storage.deleteThesis(thesis.id)

    const state = storage.loadState()
    expect(state.theses.find((item) => item.id === thesis.id)).toBeUndefined()
    expect(state.articles.find((item) => item.id === article.id)?.title).toBe('Smoke article')
  })

  it('updates thesis metadata and allows optional fields to be cleared', () => {
    const storage = loadStorage(makeHome())
    const thesis = storage.createThesis({
      title: 'Original thesis',
      titleEn: 'Original',
      author: 'Author',
      supervisor: 'Supervisor',
      institution: 'Institution',
      department: 'Department',
      degree: 'Master',
      abstractZh: '摘要',
      abstractEn: 'Abstract',
      keywords: ['old'],
    })

    storage.updateThesisMeta(thesis.id, {
      title: 'Updated thesis',
      author: '',
      supervisor: '',
      institution: '',
      department: '',
      abstractZh: '',
      abstractEn: '',
      keywords: [],
    })

    const updated = storage.loadState().theses.find((item) => item.id === thesis.id)
    expect(updated?.title).toBe('Updated thesis')
    expect(updated?.author).toBe('')
    expect(updated?.supervisor).toBe('')
    expect(updated?.institution).toBe('')
    expect(updated?.department).toBe('')
    expect(updated?.abstractZh).toBe('')
    expect(updated?.abstractEn).toBe('')
    expect(updated?.keywords).toEqual([])
  })

  it('writes, edits, deletes, and exports thesis section text blocks', () => {
    const storage = loadStorage(makeHome())
    const thesis = storage.createThesis({
      title: 'Exportable thesis',
      titleEn: 'Exportable thesis',
      author: 'Author',
      supervisor: '',
      institution: '',
      department: '',
      degree: 'Master',
      abstractZh: '',
      abstractEn: '',
      keywords: [],
    })
    const chapter = thesis.sections.find((section) => section.type === 'Chapter') ?? thesis.sections[0]

    const block = storage.addThesisTextBlock(thesis.id, chapter.id, '第一版大论文章节正文', 'manual thesis draft')
    storage.updateThesisTextBlock(thesis.id, block.id, '第二版大论文章节正文', 'edited thesis draft')
    const exportPath = storage.exportThesisMarkdown(thesis.id)

    expect(fs.readFileSync(exportPath, 'utf-8')).toContain('第二版大论文章节正文')

    storage.deleteThesisBlock(thesis.id, block.id)
    const updated = storage.loadState().theses.find((item) => item.id === thesis.id)
    const updatedChapter = updated?.sections.find((section) => section.id === chapter.id)
    expect(updatedChapter?.contentBlocks).toHaveLength(0)
  })

  it('updates and deletes review comments and review rounds', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.addReviewRound(article.id, {
      submittedAt: '2026-05-06',
      journalName: 'Journal',
      manuscriptNumber: 'MS-1',
    })
    let state = storage.loadState()
    const round = state.articles.find((item) => item.id === article.id)!.reviewRounds[0]
    storage.addReviewComment(article.id, round.id, {
      reviewerId: 'Reviewer 1',
      originalText: 'Clarify the method.',
      type: 'Major',
      suggestedSection: 'MaterialsAndMethods',
    })
    state = storage.loadState()
    const comment = state.articles.find((item) => item.id === article.id)!.reviewRounds[0].comments[0]

    storage.updateReviewComment(article.id, round.id, comment.id, {
      reviewerId: 'Reviewer 2',
      originalText: 'Clarify the statistical method.',
      type: 'Minor',
      suggestedSection: 'Results',
      status: 'InProgress',
    })
    state = storage.loadState()
    const updatedComment = state.articles.find((item) => item.id === article.id)!.reviewRounds[0].comments[0]
    expect(updatedComment.reviewerId).toBe('Reviewer 2')
    expect(updatedComment.originalText).toBe('Clarify the statistical method.')
    expect(updatedComment.type).toBe('Minor')
    expect(updatedComment.status).toBe('InProgress')

    storage.deleteReviewComment(article.id, round.id, comment.id)
    state = storage.loadState()
    expect(state.articles.find((item) => item.id === article.id)!.reviewRounds[0].comments).toHaveLength(0)

    storage.deleteReviewRound(article.id, round.id)
    state = storage.loadState()
    expect(state.articles.find((item) => item.id === article.id)!.reviewRounds).toHaveLength(0)
  })

  it('updates review round metadata and edits or deletes revision responses', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.addReviewRound(article.id, {
      submittedAt: '2026-05-01',
      journalName: 'Old Journal',
      manuscriptNumber: 'OLD-1',
    })
    let state = storage.loadState()
    const round = state.articles.find((item) => item.id === article.id)!.reviewRounds[0]
    storage.updateReviewRound(article.id, round.id, {
      submittedAt: '2026-05-02',
      journalName: 'New Journal',
      manuscriptNumber: 'NEW-2',
      reviewReceivedAt: '2026-05-06',
    })
    storage.addReviewComment(article.id, round.id, {
      reviewerId: 'Reviewer 1',
      originalText: 'Please clarify the introduction.',
      type: 'Major',
      suggestedSection: 'Introduction',
    })
    state = storage.loadState()
    const comment = state.articles.find((item) => item.id === article.id)!.reviewRounds[0].comments[0]
    storage.addRevision(article.id, round.id, comment.id, {
      description: 'Old response',
      responseText: 'We changed the wrong section.',
      markCompleted: true,
    })
    state = storage.loadState()
    const revision = state.articles.find((item) => item.id === article.id)!.reviewRounds[0].comments[0].revisions[0]

    storage.updateRevision(article.id, round.id, comment.id, revision.id, {
      description: 'Updated response',
      responseText: 'We clarified the introduction.',
      isVerified: true,
    })

    let updatedArticle = storage.loadState().articles.find((item) => item.id === article.id)!
    let updatedRound = updatedArticle.reviewRounds[0]
    let updatedRevision = updatedRound.comments[0].revisions[0]
    expect(updatedRound.journalName).toBe('New Journal')
    expect(updatedRound.manuscriptNumber).toBe('NEW-2')
    expect(updatedRound.reviewReceivedAt).toBe('2026-05-06')
    expect(updatedRevision.description).toBe('Updated response')
    expect(updatedRevision.responseText).toBe('We clarified the introduction.')
    expect(updatedRevision.isVerified).toBe(true)

    storage.deleteRevision(article.id, round.id, comment.id, revision.id)

    updatedArticle = storage.loadState().articles.find((item) => item.id === article.id)!
    expect(updatedArticle.reviewRounds[0].comments[0].revisions).toHaveLength(0)
  })

  it('rejects empty manual review comments and empty revision records', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.addReviewRound(article.id, {
      submittedAt: '2026-05-06',
      journalName: 'Journal',
      manuscriptNumber: 'MS-1',
    })
    const round = storage.loadState().articles.find((item) => item.id === article.id)!.reviewRounds[0]

    expect(() => storage.addReviewComment(article.id, round.id, {
      reviewerId: 'Reviewer 1',
      originalText: '   ',
      type: 'Major',
      suggestedSection: 'Results',
    })).toThrow('Review comment cannot be empty')

    storage.addReviewComment(article.id, round.id, {
      reviewerId: 'Reviewer 1',
      originalText: 'Please clarify the result.',
      type: 'Major',
      suggestedSection: 'Results',
    })
    const comment = storage.loadState().articles.find((item) => item.id === article.id)!.reviewRounds[0].comments[0]

    expect(() => storage.addRevision(article.id, round.id, comment.id, {
      description: '',
      responseText: '   ',
    })).toThrow('Revision response cannot be empty')
  })

  it('updates and deletes citations after import mistakes', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.addCitation(article.id, {
      title: 'Original title',
      authors: 'A. Author',
      year: '2024',
      journal: 'Original journal',
      doi: '10.1000/original',
    })
    let state = storage.loadState()
    const citation = state.articles.find((item) => item.id === article.id)!.citations[0]

    storage.updateCitation(article.id, citation.id, {
      title: 'Corrected title',
      authors: 'B. Author',
      year: '2026',
      journal: 'Corrected journal',
      doi: '10.1000/corrected',
    })
    state = storage.loadState()
    const updated = state.articles.find((item) => item.id === article.id)!.citations[0]
    expect(updated.title).toBe('Corrected title')
    expect(updated.authors).toBe('B. Author')
    expect(updated.year).toBe('2026')
    expect(updated.journal).toBe('Corrected journal')
    expect(updated.doi).toBe('10.1000/corrected')

    storage.deleteCitation(article.id, citation.id)
    state = storage.loadState()
    expect(state.articles.find((item) => item.id === article.id)!.citations).toHaveLength(0)
  })

  it('updates daily progress entries after mistaken logging', () => {
    const storage = loadStorage(makeHome())
    storage.addProgressEntry({
      articleId: '',
      kind: 'read',
      title: 'Read old paper',
      detail: 'Old detail',
    })
    const entry = storage.loadState().progressEntries[0]

    storage.updateProgressEntry(entry.id, {
      kind: 'analysis',
      title: 'Ran analysis',
      detail: 'Updated detail',
      minutesSpent: 45,
    })

    const updated = storage.loadState().progressEntries[0]
    expect(updated.kind).toBe('analysis')
    expect(updated.title).toBe('Ran analysis')
    expect(updated.detail).toBe('Updated detail')
    expect(updated.minutesSpent).toBe(45)
  })

  it('smoke-tests manuscript import, review response, thesis linking, and export', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.importManuscriptSections(article.id, [
      {
        sectionType: 'Introduction',
        content: 'This study asks a focused biological question.',
        description: 'Imported introduction',
        sourceName: 'draft.docx',
      },
      {
        sectionType: 'Results',
        content: 'The treatment increased expression by two fold.',
        description: 'Imported results',
        sourceName: 'draft.docx',
      },
    ])
    storage.importReviewComments(article.id, {
      submittedAt: '2026-05-06',
      journalName: 'Journal',
      manuscriptNumber: 'MS-42',
      groups: [
        {
          reviewerId: 'Reviewer 1',
          comments: [
            {
              originalText: 'Please explain the biological relevance.',
              type: 'Major',
              suggestedSection: 'Discussion',
            },
            {
              originalText: 'Fix one typo in the methods.',
              type: 'Minor',
              suggestedSection: 'MaterialsAndMethods',
            },
          ],
        },
      ],
    })

    let state = storage.loadState()
    const round = state.articles.find((item) => item.id === article.id)!.reviewRounds[0]
    const comment = round.comments[0]
    storage.addRevision(article.id, round.id, comment.id, {
      description: 'Added biological relevance discussion',
      responseText: 'We added one paragraph to the Discussion.',
      markCompleted: true,
    })
    const thesis = storage.createThesis({
      title: 'Smoke thesis',
      titleEn: '',
      author: 'Author',
      supervisor: '',
      institution: '',
      department: '',
      degree: 'Master',
      abstractZh: '',
      abstractEn: '',
      keywords: [],
    })
    storage.linkArticleToThesis(thesis.id, article.id)
    const thesisExport = storage.exportThesisMarkdown(thesis.id)
    const articleExport = storage.exportMarkdown(article.id)

    state = storage.loadState()
    const updatedArticle = state.articles.find((item) => item.id === article.id)!
    const updatedThesis = state.theses.find((item) => item.id === thesis.id)!

    expect(updatedArticle.sections.find((section) => section.type === 'Results')?.contentBlocks[0]?.content).toContain('two fold')
    expect(updatedArticle.reviewRounds[0].comments).toHaveLength(2)
    expect(updatedArticle.reviewRounds[0].comments[0].status).toBe('Completed')
    expect(updatedThesis.articleIds).toContain(article.id)
    expect(fs.readFileSync(articleExport, 'utf-8')).toContain('focused biological question')
    expect(fs.readFileSync(thesisExport, 'utf-8')).toContain('Smoke thesis')
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

  it('retries database rename when Windows temporarily locks the destination', () => {
    const storage = loadStorage(makeHome())
    const originalRename = fs.renameSync
    let attempts = 0

    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (String(to).endsWith('database.json') && attempts === 0) {
        attempts += 1
        const error = new Error('temporary Windows lock') as NodeJS.ErrnoException
        error.code = 'EPERM'
        throw error
      }
      attempts += 1
      return originalRename(from, to)
    }) as typeof fs.renameSync

    try {
      const article = createSmokeArticle(storage)

      expect(article.id).toBeTruthy()
      expect(attempts).toBeGreaterThanOrEqual(2)
    } finally {
      fs.renameSync = originalRename
    }
  })

  it('exports and restores a complete app backup with database and attachments', () => {
    const home = makeHome()
    const storage = loadStorage(home)
    const article = createSmokeArticle(storage)
    storage.addTextBlock(article.id, 'Results', 'backup protected content', 'draft')

    const articleDir = storage.getArticleDirectory(article.id)
    const attachmentDir = path.join(articleDir, 'Attachments')
    fs.mkdirSync(attachmentDir, { recursive: true })
    fs.writeFileSync(path.join(attachmentDir, 'result-table.txt'), 'attachment payload', 'utf-8')

    const backupPath = storage.exportFullBackup(path.join(home, 'Desktop'))
    fs.rmSync(storage.BASE_DIRECTORY, { recursive: true, force: true })

    const restoreResult = storage.restoreFullBackup(backupPath)
    const restoredState = storage.loadState()

    expect(restoreResult.restoredFiles).toBeGreaterThan(0)
    expect(restoredState.articles.find((item) => item.id === article.id)?.title).toBe('Smoke article')
    expect(firstBlock(storage, article.id, 'Results')?.content).toBe('backup protected content')
    expect(fs.readFileSync(path.join(attachmentDir, 'result-table.txt'), 'utf-8')).toBe('attachment payload')
  })
})

describe('storage LLM providers', () => {
  it('defaults provider temperature to zero and activates newly added providers', () => {
    const storage = loadStorage(makeHome())

    const initial = storage.listProviders()
    const defaultProvider = initial.providers.find((provider) => provider.id === 'deepseek-v4-flash')
    expect(defaultProvider?.temperature).toBe(0)

    const first = storage.addProvider({
      name: 'First provider',
      kind: 'openai-compat',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'first-model',
      supportsToolUse: true,
    })
    storage.setActiveProvider(first.id)

    const second = storage.addProvider({
      name: 'Second provider',
      kind: 'openai-compat',
      baseUrl: 'http://127.0.0.1:11435/v1',
      model: 'second-model',
      supportsToolUse: true,
    })

    expect(second.temperature).toBe(0)
    expect(storage.listProviders().activeId).toBe(second.id)
  })

  it('can activate a provider as part of provider updates', () => {
    const storage = loadStorage(makeHome())
    const first = storage.addProvider({
      name: 'First provider',
      kind: 'openai-compat',
      baseUrl: 'http://127.0.0.1:11434/v1',
      model: 'first-model',
      supportsToolUse: true,
    })
    const second = storage.addProvider({
      name: 'Second provider',
      kind: 'openai-compat',
      baseUrl: 'http://127.0.0.1:11435/v1',
      model: 'second-model',
      supportsToolUse: true,
    })
    storage.setActiveProvider(first.id)

    storage.updateProvider(second.id, { activate: true })

    expect(storage.listProviders().activeId).toBe(second.id)
  })

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

  it('restores replaced section text when undoing a replace import batch', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.addTextBlock(article.id, 'Results', 'Original result text that must survive undo.', 'original')
    storage.importManuscriptSections(article.id, [
      { sectionType: 'Results', content: 'Imported replacement result text.' },
    ], 'replace')

    let imported = storage.loadState().articles.find((item) => item.id === article.id)
    expect(imported?.sections.find((section) => section.type === 'Results')?.contentBlocks.map((block) => block.content)).toEqual([
      'Imported replacement result text.',
    ])

    storage.undoLastImportBatch(article.id)
    imported = storage.loadState().articles.find((item) => item.id === article.id)
    expect(imported?.sections.find((section) => section.type === 'Results')?.contentBlocks.map((block) => block.content)).toEqual([
      'Original result text that must survive undo.',
    ])
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

describe('storage update guards', () => {
  it('preserves target journal when updating only article title or status', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    storage.updateArticleMeta(article.id, { status: 'Submitted' })
    storage.updateArticleMeta(article.id, { title: 'Renamed article' })

    const updated = storage.loadState().articles.find((item) => item.id === article.id)
    expect(updated?.title).toBe('Renamed article')
    expect(updated?.status).toBe('Submitted')
    expect(updated?.targetJournal).toBe('Journal')
  })

  it('rejects empty or unknown article metadata patches', () => {
    const storage = loadStorage(makeHome())
    const article = createSmokeArticle(storage)

    expect(() => storage.updateArticleMeta(article.id, {})).toThrow(/未识别|field|patch/i)
    expect(() => storage.updateArticleMeta(article.id, { bogus: 'x' })).toThrow(/未识别|field|patch/i)
  })
})

describe('storage local-day statistics', () => {
  it('counts pomodoro sessions by local calendar date instead of UTC date prefix', () => {
    const storage = loadStorage(makeHome())
    const RealDate = Date
    const fixed = new RealDate(2026, 4, 7, 0, 30, 0)

    class FixedDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super(fixed.getTime())
        } else {
          super(...args)
        }
      }

      static now() {
        return fixed.getTime()
      }
    }

    globalThis.Date = FixedDate as DateConstructor
    try {
      storage.addPomodoroSession(25)
      expect(storage.getPomodoroStats().todaySessions).toBe(1)
    } finally {
      globalThis.Date = RealDate
    }
  })
})

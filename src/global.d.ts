import type { AnnotationAuthor, AnnotationStatus, AppState, ArticleStatus, BlockPreview, Citation, CreateArticlePayload, CreateThesisPayload, LlmProviderKind, LlmProvidersState, LlmStreamEvent, LlmTestResult, McpInfo, MoodType, SectionType, ThemeType, UpdateThesisPayload, WritingStats, WritingStreak, TagColor, WritingScenario, ItalicGuide, ZoteroConfig, ProgressEntry, ProgressEntryKind, Finding, FindingStatus, DailySession } from './types'
import type { BibTeXEntry } from './utils/bibtexParser'
import type { ParsedManuscriptSection, ParsedReviewerGroup } from './utils/importParsers'

declare global {
  interface Window {
    scipaper: {
      bootstrap: () => Promise<AppState>
      getMcpInfo: () => Promise<McpInfo>
      createArticle: (payload: CreateArticlePayload) => Promise<AppState>
      deleteArticle: (articleId: string) => Promise<AppState>
      updateArticleMeta: (
        articleId: string,
        patch: { title: string; targetJournal: string; status: ArticleStatus },
      ) => Promise<AppState>
      updateResearchContext: (
        articleId: string,
        researchContext: CreateArticlePayload['researchContext'],
      ) => Promise<AppState>
      addTextBlock: (
        articleId: string,
        sectionType: SectionType,
        content: string,
        description?: string,
      ) => Promise<AppState>
      updateTextBlock: (
        articleId: string,
        blockId: string,
        content: string,
        description?: string,
      ) => Promise<AppState>
      recordBlockVersion: (
        articleId: string,
        blockId: string,
        changeDescription?: string,
      ) => Promise<AppState>
      deleteBlock: (articleId: string, blockId: string) => Promise<AppState>
      addAnnotation: (
        articleId: string,
        blockId: string,
        payload: { anchorText: string; comment: string; author: AnnotationAuthor },
      ) => Promise<AppState>
      updateAnnotation: (
        articleId: string,
        annotationId: string,
        patch: { comment?: string; status?: AnnotationStatus },
      ) => Promise<AppState>
      deleteAnnotation: (articleId: string, annotationId: string) => Promise<AppState>
      annotateText: (params: {
        sectionType: SectionType
        anchorText: string
        contextBefore: string
        contextAfter: string
        articleLanguage?: 'zh' | 'en'
        providerId?: string
      }) => Promise<{ ok: boolean; comment: string }>
      llmKeyStoreInfo: () => Promise<{ mode: string; keyDir: string; isPackaged: boolean; warning: string | null }>
      importAssetBlock: (
        articleId: string,
        sectionType: SectionType,
        kind: 'image' | 'file',
      ) => Promise<AppState>
      selectImportTextFile: () => Promise<{ filePath: string; fileName: string; text: string } | null>
      importManuscriptSections: (
        articleId: string,
        sections: Array<Pick<ParsedManuscriptSection, 'sectionType' | 'content'> & { description?: string; sourceName?: string }>,
        mode?: 'append' | 'replace',
      ) => Promise<AppState>
      importReviewComments: (
        articleId: string,
        payload: {
          roundId?: string
          submittedAt?: string
          journalName?: string
          manuscriptNumber?: string
          reviewReceivedAt?: string
          sourceName?: string
          groups: ParsedReviewerGroup[]
        },
      ) => Promise<AppState>
      undoLastImport: (articleId: string) => Promise<AppState>
      reformatImportText: (payload: {
        text: string
        mode: 'manuscript' | 'review'
        articleLanguage?: 'zh' | 'en'
        providerId?: string
      }) => Promise<{ text: string }>
      openBlockAsset: (articleId: string, blockId: string) => Promise<boolean>
      getBlockPreview: (articleId: string, blockId: string) => Promise<BlockPreview>
      openArticleFolder: (articleId: string) => Promise<boolean>
      addReviewRound: (
        articleId: string,
        payload: {
          submittedAt: string
          journalName: string
          manuscriptNumber: string
          reviewReceivedAt?: string
        },
      ) => Promise<AppState>
      addReviewComment: (
        articleId: string,
        roundId: string,
        payload: {
          reviewerId: string
          originalText: string
          type: 'Major' | 'Minor'
          suggestedSection: string
        },
      ) => Promise<AppState>
      updateReviewCommentStatus: (
        articleId: string,
        roundId: string,
        commentId: string,
        status: 'Pending' | 'InProgress' | 'Completed' | 'Disagreed',
      ) => Promise<AppState>
      updateReviewComment: (
        articleId: string,
        roundId: string,
        commentId: string,
        patch: {
          reviewerId?: string
          originalText?: string
          type?: 'Major' | 'Minor'
          suggestedSection?: string
          status?: 'Pending' | 'InProgress' | 'Completed' | 'Disagreed'
        },
      ) => Promise<AppState>
      deleteReviewComment: (articleId: string, roundId: string, commentId: string) => Promise<AppState>
      deleteReviewRound: (articleId: string, roundId: string) => Promise<AppState>
      addRevision: (
        articleId: string,
        roundId: string,
        commentId: string,
        payload: {
          description: string
          responseText: string
          markCompleted?: boolean
        },
      ) => Promise<AppState>
      exportMarkdown: (articleId: string) => Promise<string>
      exportArticleDocx: (
        articleId: string,
        templateId: string,
        applyItalicGuide?: boolean,
      ) => Promise<string>
      exportArticleLatex: (articleId: string) => Promise<string>
      getWritingGuidance: (articleId: string, targetSection: SectionType) => Promise<string[]>
      copyText: (text: string) => void
      onStateChanged: (listener: () => void) => () => void

      // Thesis operations
      createThesis: (payload: CreateThesisPayload) => Promise<AppState>
      updateThesisMeta: (thesisId: string, patch: UpdateThesisPayload) => Promise<AppState>
      addThesisSection: (thesisId: string, sectionType: string, title: string) => Promise<AppState>
      linkArticleToThesis: (thesisId: string, articleId: string) => Promise<AppState>
      unlinkArticleFromThesis: (thesisId: string, articleId: string) => Promise<AppState>
      deleteThesis: (thesisId: string) => Promise<AppState>
      addThesisTextBlock: (thesisId: string, sectionId: string, content: string, description?: string) => Promise<AppState>
      updateThesisTextBlock: (thesisId: string, blockId: string, content: string, description?: string) => Promise<AppState>
      deleteThesisBlock: (thesisId: string, blockId: string) => Promise<AppState>
      exportThesisMarkdown: (thesisId: string) => Promise<string>

      // Writing streak operations
      getWritingStreak: () => Promise<WritingStreak>
      updateDailyGoal: (goal: number) => Promise<AppState>

      // Mood tracking operations
      addMoodEntry: (mood: MoodType, note?: string) => Promise<AppState>

      // Pomodoro operations
      addPomodoroSession: (duration: number, articleId?: string, sectionType?: SectionType) => Promise<AppState>

      // Citation operations
      addCitation: (articleId: string, citation: BibTeXEntry) => Promise<AppState>
      updateCitation: (articleId: string, citationId: string, patch: Partial<Citation>) => Promise<AppState>
      deleteCitation: (articleId: string, citationId: string) => Promise<AppState>

      // Theme operations
      getTheme: () => Promise<ThemeType>
      setTheme: (theme: ThemeType) => Promise<AppState>

      // Writing stats / mood / pomodoro
      getWritingStats: () => Promise<WritingStats>
      getMoodHistory: () => Promise<import('./types').MoodEntry[]>
      getPomodoroStats: () => Promise<import('./types').PomodoroStats>

      // Tag operations
      addTag: (articleId: string, tagName: string, tagColor: TagColor) => Promise<AppState>
      removeTag: (articleId: string, tagId: string) => Promise<AppState>

      // Export operations
      exportToHTML: (articleId: string) => Promise<string>
      exportToJSON: (articleId: string) => Promise<string>
      createSharePackage: (articleId: string) => Promise<string>

      // LLM provider management
      llmListProviders: () => Promise<LlmProvidersState>
      llmAddProvider: (draft: {
        name: string
        kind: LlmProviderKind
        baseUrl: string
        model: string
        temperature?: number
        maxTokens?: number
        supportsToolUse: boolean
        trustForWrite?: boolean
        apiKey: string
        presetId?: string
      }) => Promise<LlmProvidersState>
      llmUpdateProvider: (
        id: string,
        patch: {
          name?: string
          kind?: LlmProviderKind
          baseUrl?: string
          model?: string
          temperature?: number
          maxTokens?: number
          supportsToolUse?: boolean
          trustForWrite?: boolean
          apiKey?: string
        },
      ) => Promise<LlmProvidersState>
      llmDeleteProvider: (id: string) => Promise<LlmProvidersState>
      llmSetActiveProvider: (id: string) => Promise<LlmProvidersState>
      llmTestProvider: (id: string) => Promise<LlmTestResult>

      // LLM chat
      llmStartChat: (params: {
        sessionId: string
        userMessage: string
        history: { role: 'user' | 'assistant'; content: string }[]
        currentArticle: {
          id: string
          title: string
          targetJournal: string
          status: string
          researchContext: {
            scientificQuestion: string
            observedPhenomenon: string
            hypothesis: string
            approach: string
          }
        } | null
        currentSection: { type: string; contentExcerpt: string; currentBlockId?: string | null } | null
        scenarioId?: string
      }) => Promise<{ ok: boolean; error?: string }>
      llmCancelSession: (sessionId: string) => Promise<void>
      llmApprove: (sessionId: string, callId: string, approved: boolean, alwaysAllow: boolean) => Promise<void>
      llmOnEvent: (listener: (event: LlmStreamEvent) => void) => () => void

      // Writing scenarios
      listScenarios: () => Promise<WritingScenario[]>
      addScenario: (draft: Omit<WritingScenario, 'id' | 'builtin'>) => Promise<WritingScenario>
      updateScenario: (id: string, patch: Partial<Omit<WritingScenario, 'id' | 'builtin'>>) => Promise<WritingScenario>
      deleteScenario: (id: string) => Promise<void>
      resetScenarioToDefault: (id: string) => Promise<WritingScenario>

      // Italic guide
      getItalicGuide: () => Promise<ItalicGuide>
      setItalicGuide: (config: ItalicGuide) => Promise<ItalicGuide>

      // Zotero
      getZoteroConfig: () => Promise<ZoteroConfig>
      setZoteroConfig: (config: ZoteroConfig) => Promise<ZoteroConfig>

      // Custom autocomplete vocabulary (merges into general bucket)
      getCustomVocab: () => Promise<import('./types').CustomVocab>
      addCustomVocabWord: (word: string) => Promise<import('./types').CustomVocab>
      removeCustomVocabWord: (word: string) => Promise<import('./types').CustomVocab>
      addCustomVocabPhrase: (entry: import('./types').CustomVocabPhrase) => Promise<import('./types').CustomVocab>
      removeCustomVocabPhrase: (trigger: string, text?: string) => Promise<import('./types').CustomVocab>
      clearCustomVocab: () => Promise<import('./types').CustomVocab>

      // Vocab pack registry
      listVocabPacks: () => Promise<import('./types').VocabPackSummary[]>
      setVocabPackEnabled: (id: string, enabled: boolean) => Promise<import('./types').VocabPackSummary[]>
      importVocabPack: (pack: {
        id?: string
        name: string
        description?: string
        words: Partial<Record<import('./types').SciSection, string[]>> | string[]
        phrases?: Partial<Record<import('./types').SciSection, import('./types').SciPhrase[]>> | import('./types').SciPhrase[]
      }) => Promise<import('./types').VocabPack>
      deleteCustomVocabPack: (id: string) => Promise<import('./types').VocabPackSummary[]>
      renameCustomVocabPack: (id: string, name: string) => Promise<import('./types').VocabPack>
      getCustomVocabPacks: () => Promise<import('./types').VocabPack[]>

      // User profile
      getUserProfile: () => Promise<import('./types').UserProfile>
      setUserProfile: (patch: Partial<import('./types').UserProfile>) => Promise<AppState>

      // Auto-approve tool calls
      getAutoApproveTools: () => Promise<boolean>
      setAutoApproveTools: (value: boolean) => Promise<boolean>

      // Progress entries / Findings / Daily session
      addProgressEntry: (payload: {
        articleId: string
        kind: ProgressEntryKind
        title: string
        detail?: string
        sectionId?: string
        findingId?: string
        citationId?: string
        minutesSpent?: number
        date?: string
      }) => Promise<AppState>
      updateProgressEntry: (entryId: string, patch: Partial<Omit<ProgressEntry, 'id' | 'createdAt' | 'createdBy'>>) => Promise<AppState>
      deleteProgressEntry: (entryId: string) => Promise<AppState>
      listProgressEntries: (filter?: {
        articleId?: string
        date?: string
        dateFrom?: string
        dateTo?: string
        kind?: ProgressEntryKind
        findingId?: string
      }) => Promise<ProgressEntry[]>
      linkProgressToFinding: (entryId: string, findingId: string) => Promise<AppState>
      addFinding: (
        articleId: string,
        sectionType: SectionType,
        payload: { title: string; description?: string; status?: FindingStatus },
      ) => Promise<AppState>
      updateFinding: (
        articleId: string,
        findingId: string,
        patch: { title?: string; description?: string; status?: FindingStatus },
      ) => Promise<AppState>
      deleteFinding: (articleId: string, findingId: string) => Promise<AppState>
      listFindings: (articleId: string, sectionType?: SectionType) => Promise<Finding[]>
      startDailySession: (date?: string, planText?: string) => Promise<AppState>
      setDailyPlan: (date: string | undefined, planText: string) => Promise<AppState>
      endDailySession: (date?: string, summaryText?: string) => Promise<AppState>
      getDailySession: (date?: string) => Promise<DailySession | null>
    }
  }
}

export {}

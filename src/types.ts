export type ArticleStatus =
  | 'Drafting'
  | 'Submitted'
  | 'UnderReview'
  | 'Revision'
  | 'Resubmitted'
  | 'Accepted'
  | 'Rejected'
  | 'Published'

export type ArticleLanguage = 'zh' | 'en'

export type SectionType =
  | 'Title'
  | 'Abstract'
  | 'Introduction'
  | 'MaterialsAndMethods'
  | 'Results'
  | 'Discussion'
  | 'References'

export type ThesisStatus =
  | 'Proposal'      // 开题
  | 'InProgress'    // 撰写中
  | 'DefenseReady'  // 可答辩
  | 'Defended'      // 已答辩
  | 'Revised'       // 修改中
  | 'Final'         // 终版

export type ThesisSectionType =
  | 'Cover'           // 封面
  | 'Declaration'     // 声明
  | 'Abstract'        // 摘要
  | 'Acknowledgements'// 致谢
  | 'TableOfContents' // 目录
  | 'ListOfFigures'   // 图目录
  | 'ListOfTables'    // 表目录
  | 'Chapter'         // 章节（通用）
  | 'Conclusion'      // 结论
  | 'References'      // 参考文献
  | 'Appendix'        // 附录

export type BlockType = 'Text' | 'Image' | 'FileLink'
export type ReviewCommentType = 'Major' | 'Minor'
export type CommentStatus = 'Pending' | 'InProgress' | 'Completed' | 'Disagreed'

export type MoodType =
  | 'Happy'
  | 'Calm'
  | 'Sad'
  | 'Frustrated'
  | 'Anxious'
  | 'Excited'
  | 'Tired'
  | 'Grateful'
  | 'Motivated'
  | 'Melancholy'

export interface MoodEntry {
  id: string
  date: string
  mood: MoodType
  note?: string
  createdAt: string
}

export interface ContentBlockVersion {
  id: string
  content: string
  modifiedAt: string
  modifiedBy: string
  changeDescription: string
}

export interface ContentBlock {
  id: string
  sectionId: string
  type: BlockType
  content: string
  description: string
  orderIndex: number
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  versions: ContentBlockVersion[]
  resolvedPath?: string | null
  previewUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  /** Set when the asset path can't be resolved on this platform — e.g.
   *  Windows-formatted absolute path on macOS. UI shows a re-link prompt. */
  assetError?: string | null
  annotations?: BlockAnnotation[]
}

export type AnnotationStatus = 'open' | 'resolved'
export type AnnotationAuthor = 'user' | 'ai'

export interface BlockAnnotation {
  id: string
  blockId: string
  /** Verbatim quote of the annotated span — used to re-anchor on the
   *  current document, since byte offsets shift as the user edits. */
  anchorText: string
  comment: string
  author: AnnotationAuthor
  status: AnnotationStatus
  createdAt: string
  updatedAt: string
}

export type FindingStatus = 'planned' | 'inProgress' | 'done'

export interface Finding {
  id: string
  sectionId: string
  title: string
  description?: string
  status: FindingStatus
  orderIndex: number
  createdAt: string
  updatedAt: string
}

export interface Section {
  id: string
  type: SectionType
  orderIndex: number
  contentBlocks: ContentBlock[]
  findings?: Finding[]
}

export type ProgressEntryKind =
  | 'read'        // 读了一篇/一段文献
  | 'experiment'  // 做了实验
  | 'writing'     // 写了字（也会自动从 add_text_block 派生）
  | 'idea'        // 蹦出一个新想法/假设
  | 'cite'        // 录入了一条参考文献
  | 'analysis'    // 跑了数据分析
  | 'focus'       // 一段番茄钟专注
  | 'mood'        // 一次心情记录

export interface ProgressEntry {
  id: string
  date: string             // YYYY-MM-DD
  articleId: string        // 必须挂到一篇文章
  kind: ProgressEntryKind
  title: string            // 一句话："读了 Smith 2024，找到 piRNA 通路反例"
  detail?: string
  sectionId?: string
  findingId?: string
  citationId?: string
  minutesSpent?: number
  createdAt: string
  createdBy: 'user' | 'ai'
}

export interface DailySession {
  date: string             // YYYY-MM-DD，主键
  planText?: string
  summaryText?: string
  startedAt: string
  endedAt?: string
  progressEntryIds: string[]
}

export interface ResearchContext {
  id: string
  articleId: string
  scientificQuestion: string
  observedPhenomenon: string
  hypothesis: string
  approach: string
  createdAt: string
  updatedAt: string
}

export interface Revision {
  id: string
  reviewCommentId: string
  description: string
  responseText: string
  modifiedBlockIds: string[]
  completedAt: string
  isVerified: boolean
}

export interface ReviewComment {
  id: string
  reviewRoundId: string
  reviewerId: string
  originalText: string
  type: ReviewCommentType
  suggestedSection: string
  status: CommentStatus
  revisions: Revision[]
}

export interface ReviewRound {
  id: string
  articleId: string
  roundNumber: number
  submittedAt: string
  journalName: string
  manuscriptNumber: string
  reviewReceivedAt: string
  comments: ReviewComment[]
}

export const TAG_COLORS = [
  '#e74c3c', // Red
  '#e67e22', // Orange
  '#f1c40f', // Yellow
  '#2ecc71', // Green
  '#1abc9c', // Teal
  '#3498db', // Blue
  '#9b59b6', // Purple
  '#e91e63', // Pink
  '#607d8b', // Blue Grey
  '#795548', // Brown
] as const

export type TagColor = typeof TAG_COLORS[number]

export interface Tag {
  id: string
  name: string
  color: TagColor
  createdAt: string
}

export interface Citation {
  id?: string
  articleId?: string
  bibtex?: string
  title?: string
  authors?: string
  year?: string
  journal?: string
  volume?: string
  number?: string
  pages?: string
  publisher?: string
  doi?: string
  url?: string
  localPdfPath?: string
  sectionLinks?: {
    citationId: string
    sectionId: string
    context: string
  }[]
}

export interface Article {
  id: string
  title: string
  targetJournal: string
  status: ArticleStatus
  /** Writing language of the manuscript itself. AI always replies in Chinese
   *  to the (Chinese-speaking) user, but produces example sentences and
   *  critiques the manuscript text in this language. */
  language?: ArticleLanguage
  createdAt: string
  updatedAt: string
  researchContext: ResearchContext
  sections: Section[]
  reviewRounds: ReviewRound[]
  citations: Citation[]
  tags: Tag[]
}

export interface ThesisSection {
  id: string
  thesisId: string
  type: ThesisSectionType
  title: string
  orderIndex: number
  linkedArticleId?: string
  contentBlocks: ContentBlock[]
}

export interface Thesis {
  id: string
  title: string
  titleEn?: string
  author: string
  supervisor: string
  institution: string
  department: string
  degree: 'Master' | 'PhD'
  status: ThesisStatus
  createdAt: string
  updatedAt: string
  articleIds: string[]
  sections: ThesisSection[]
  abstractZh: string
  abstractEn: string
  keywords: string[]
}

export interface WordCountStats {
  totalWords: number
  totalChars: number
  todayWords: number
  todayChars: number
  sectionCounts: {
    sectionId: string
    sectionType: string
    words: number
    chars: number
  }[]
}

export interface WritingStreak {
  currentStreak: number
  longestStreak: number
  totalWritingDays: number
  todayWords: number
  dailyGoal: number
  lastWriteDate: string
  todayAddedWords?: number
  todayRemovedWords?: number
  todayChangedWords?: number
  todayByAI?: number
  todayByManual?: number
  streakHistory: {
    date: string
    words: number
    goalMet: boolean
    addedWords?: number
    removedWords?: number
    changedWords?: number
    byAI?: number
    byManual?: number
  }[]
  moodHistory: MoodEntry[]
}

export interface SearchResult {
  id: string
  type: 'article' | 'thesis'
  title: string
  sectionType: string
  content: string
  matchStart: number
  matchEnd: number
  snippet: string
  sectionId?: string
  blockId?: string
}

export interface PomodoroSession {
  id: string
  startTime: string
  endTime: string
  duration: number // in minutes
  completed: boolean
  articleId?: string
  sectionType?: string
}

export interface PomodoroStats {
  todaySessions: number
  todayMinutes: number
  totalSessions: number
  totalMinutes: number
  currentStreak: number
  longestStreak: number
}

export interface WritingStats {
  totalArticles: number
  totalWords: number
  averageWordsPerArticle: number
  mostUsedWords: { word: string; count: number }[]
  topSections: { section: string; words: number }[]
}

export type ThemeType = 'claude' | 'pixel' | 'fresh'

export interface CustomVocabPhrase {
  trigger: string
  text: string
  label?: string
}

export interface CustomVocab {
  words: string[]
  phrases: CustomVocabPhrase[]
}

export type { VocabPack, SciSection, SciPhrase } from './data/sci-vocab'

/** Per-pack enabled override. Missing keys fall back to pack.defaultEnabled. */
export type VocabPackPrefs = Record<string, boolean>

/** Pack registry entry returned by IPC `vocabPacks:list`. Effective enabled
 *  state is resolved on the backend by merging vocabPackPrefs over each
 *  pack's defaultEnabled. */
export interface VocabPackSummary {
  id: string
  name: string
  description: string
  builtin: boolean
  defaultEnabled: boolean
  enabled: boolean
}

export interface AppState {
  baseDirectory: string
  articles: Article[]
  theses: Thesis[]
  writingStreak: WritingStreak
  pomodoroStats: PomodoroStats
  theme: ThemeType
  progressEntries?: ProgressEntry[]
  dailySessions?: DailySession[]
  customVocab?: CustomVocab
}

export interface McpInfo {
  command: string
  args: string[]
  baseDirectory: string
  configJson: string
  examples?: {
    cursor: string
    claudeCode: string
  }
}

export interface BlockPreview {
  path: string
  previewKind: 'image' | 'pdf' | 'tiff' | 'none'
  fileName: string
  extension: string
  bufferBase64?: string
}

export interface CreateArticlePayload {
  title: string
  targetJournal: string
  status?: ArticleStatus
  language?: ArticleLanguage
  researchContext: {
    scientificQuestion: string
    observedPhenomenon: string
    hypothesis: string
    approach: string
  }
}

export interface CreateThesisPayload {
  title: string
  titleEn: string
  author: string
  supervisor: string
  institution: string
  department: string
  degree: 'Master' | 'PhD'
  abstractZh: string
  abstractEn: string
  keywords: string[]
}

export interface UpdateThesisPayload {
  title?: string
  titleEn?: string
  author?: string
  supervisor?: string
  institution?: string
  department?: string
  degree?: 'Master' | 'PhD'
  status?: ThesisStatus
  abstractZh?: string
  abstractEn?: string
  keywords?: string[]
}

export type LlmProviderKind = 'openai-compat' | 'anthropic'

export interface LlmProvider {
  id: string
  name: string
  kind: LlmProviderKind
  baseUrl: string
  model: string
  hasApiKey: boolean
  temperature?: number
  maxTokens?: number
  supportsToolUse: boolean
  trustForWrite?: boolean
  presetId?: string
  createdAt?: string
  updatedAt?: string
}

export interface LlmPreset {
  presetId: string
  name: string
  kind: LlmProviderKind
  baseUrl: string
  defaultModel: string
  description: string
  supportsToolUse: boolean
}

export interface LlmProvidersState {
  providers: LlmProvider[]
  activeId: string | null
  presets: LlmPreset[]
}

export interface LlmTestResult {
  ok: boolean
  message: string
}

export type AssistantMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; pending?: boolean }
  | {
      id: string
      role: 'tool'
      toolName: string
      status: 'pending' | 'approved' | 'rejected' | 'running' | 'success' | 'error'
      summary: string
      argsJson?: string
      result?: string
    }
  | { id: string; role: 'system'; text: string }

export interface ApprovalRequest {
  callId: string
  toolName: string
  summary: string
  args: Record<string, unknown>
}

export interface WritingScenario {
  id: string
  name: string
  description: string
  triggerSection: string  // SectionType | 'any'
  systemPromptAddon: string
  userTemplate?: string
  builtin: boolean
  enabled: boolean
}

export interface ZoteroConfig {
  endpoint: string  // e.g. 'http://localhost:23119'
  userId: string    // Zotero user id, '0' for local
  enabled: boolean
}

export interface ItalicGuide {
  prompt: string  // meta-prompt explaining italic conventions to the LLM
  enabled: boolean
}

export interface LlmStreamEvent {
  sessionId: string
  kind:
    | 'textDelta'
    | 'toolEvent'
    | 'limit'
    | 'done'
    | 'error'
  delta?: string
  callId?: string
  toolName?: string
  summary?: string
  argsJson?: string
  result?: string
  status?: 'pending' | 'approved' | 'rejected' | 'running' | 'success' | 'error'
  message?: string
  toolEventKind?: 'askApproval' | 'result'
}

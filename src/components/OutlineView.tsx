import type { Article, Finding, ProgressEntry, Section, SectionType } from '../types'
import { stripHtml } from '../utils/htmlContent'

interface OutlineViewProps {
  article: Article
  progressEntries?: ProgressEntry[]
  onJumpSection: (sectionType: SectionType) => void
}

const ARTICLE_WORD_TARGET = 8000
const SECTION_DONE_WORDS = 200
const SECTION_TARGET_COUNT = 7

const SECTION_LABELS: Record<SectionType, string> = {
  Title: 'Title',
  Abstract: 'Abstract',
  Introduction: 'Introduction',
  MaterialsAndMethods: 'Materials & Methods',
  Results: 'Results',
  Discussion: 'Discussion',
  References: 'References',
}

const FINDING_STATUS_LABELS: Record<Finding['status'], string> = {
  planned: 'Planned',
  inProgress: 'In progress',
  done: 'Done',
}

function countWords(content: string) {
  const text = stripHtml(content).trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

function getTextBlocks(section: Section) {
  return section.contentBlocks.filter((block) => block.type === 'Text')
}

function getSectionWordCount(section: Section) {
  return getTextBlocks(section).reduce((total, block) => total + countWords(block.content), 0)
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3).trimEnd()}...`
}

function getFirstSentence(section: Section) {
  const textBlock = getTextBlocks(section).find((block) => stripHtml(block.content).trim())
  if (!textBlock) return 'No text yet'

  const normalized = stripHtml(textBlock.content).replace(/\s+/g, ' ').trim()
  const sentence = normalized.match(/^.*?[.!?。！？]/)?.[0] ?? normalized
  return truncateText(sentence, 80)
}

function getProgressPercent(value: number, target: number) {
  if (target <= 0) return 0
  return Math.min(100, Math.round((value / target) * 100))
}

function getTime(value: string) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function formatEntryDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

export function OutlineView({ article, progressEntries = [], onJumpSection }: OutlineViewProps) {
  const orderedSections = [...article.sections].sort((a, b) => a.orderIndex - b.orderIndex)
  const sectionSummaries = orderedSections.map((section) => {
    const wordCount = getSectionWordCount(section)
    const findingCount = section.findings?.length ?? 0

    return {
      section,
      wordCount,
      findingCount,
      firstSentence: getFirstSentence(section),
      donePercent: getProgressPercent(wordCount, SECTION_DONE_WORDS),
    }
  })

  const articleProgressEntries = progressEntries.filter((entry) => entry.articleId === article.id)
  const recentProgressEntries = [...articleProgressEntries]
    .sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt))
    .slice(0, 5)
  const totalWordCount = sectionSummaries.reduce((total, section) => total + section.wordCount, 0)
  const articleProgressPercent = getProgressPercent(totalWordCount, ARTICLE_WORD_TARGET)
  const completedSections = sectionSummaries.filter((section) => section.wordCount >= SECTION_DONE_WORDS).length
  const findingsCount = sectionSummaries.reduce((total, section) => total + section.findingCount, 0)
  const resultsFindings = orderedSections.find((section) => section.type === 'Results')?.findings ?? []

  return (
    <section className="outline-bird">
      <header className="outline-bird-heading">
        <div className="outline-bird-heading-main">
          <p className="outline-bird-eyebrow">Bird's-eye view</p>
          <h3 className="outline-bird-title">{article.title}</h3>
        </div>
      </header>

      <div className="outline-bird-summary" aria-label="Article summary">
        <div className="outline-bird-total">
          <div className="outline-bird-total-head">
            <span>Total progress</span>
            <strong>
              {totalWordCount.toLocaleString()} / {ARTICLE_WORD_TARGET.toLocaleString()} words
            </strong>
          </div>
          <div className="outline-bird-bar" aria-label={`${articleProgressPercent}% of article word target`}>
            <span style={{ width: `${articleProgressPercent}%` }} />
          </div>
        </div>

        <div className="outline-bird-stat">
          <span>Completed sections</span>
          <strong>
            {completedSections}/{SECTION_TARGET_COUNT}
          </strong>
        </div>
        <div className="outline-bird-stat">
          <span>Citations</span>
          <strong>{article.citations.length}</strong>
        </div>
        <div className="outline-bird-stat">
          <span>Findings</span>
          <strong>{findingsCount}</strong>
        </div>
        <div className="outline-bird-stat">
          <span>Progress entries</span>
          <strong>{articleProgressEntries.length}</strong>
        </div>
      </div>

      <div className="outline-bird-grid" aria-label="Article sections">
        {sectionSummaries.map(({ section, wordCount, findingCount, firstSentence, donePercent }) => (
          <button
            key={section.id}
            type="button"
            className="outline-bird-card"
            onClick={() => onJumpSection(section.type)}
          >
            <div className="outline-bird-card-head">
              <span className="outline-bird-section-label">{SECTION_LABELS[section.type]}</span>
              {findingCount > 0 ? <span className="outline-bird-badge">{findingCount} findings</span> : null}
            </div>
            <div className="outline-bird-card-count">
              <strong>{wordCount.toLocaleString()}</strong>
              <span>words</span>
            </div>
            <div className="outline-bird-mini-bar" aria-label={`${donePercent}% of section completion threshold`}>
              <span style={{ width: `${donePercent}%` }} />
            </div>
            <p className="outline-bird-card-text">{firstSentence}</p>
          </button>
        ))}
      </div>

      {resultsFindings.length > 0 ? (
        <section className="outline-bird-findings" aria-label="Findings overview">
          <div className="outline-bird-subheading">
            <h4>Findings overview</h4>
            <span>{resultsFindings.length} in Results</span>
          </div>
          <div className="outline-bird-findings-list">
            {resultsFindings.map((finding) => {
              const linkedEntries = articleProgressEntries.filter((entry) => entry.findingId === finding.id).length

              return (
                <article key={finding.id} className="outline-bird-finding">
                  <strong>{finding.title}</strong>
                  <div className="outline-bird-finding-meta">
                    <span className={`outline-bird-status outline-bird-status-${finding.status}`}>
                      {FINDING_STATUS_LABELS[finding.status]}
                    </span>
                    <span>{linkedEntries} progress</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="outline-bird-recent" aria-label="Recent progress entries">
        <div className="outline-bird-subheading">
          <h4>Recent progress</h4>
          <span>{articleProgressEntries.length} total</span>
        </div>
        {recentProgressEntries.length > 0 ? (
          <ul className="outline-bird-progress-list">
            {recentProgressEntries.map((entry) => (
              <li key={entry.id} className="outline-bird-progress-item">
                <span className="outline-bird-progress-kind">{entry.kind}</span>
                <strong>{entry.title}</strong>
                <time dateTime={entry.createdAt}>{formatEntryDate(entry.createdAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="outline-bird-empty">No progress entries for this article yet.</p>
        )}
      </section>
    </section>
  )
}

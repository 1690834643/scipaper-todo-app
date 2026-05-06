import { useEffect, useState } from 'react'
import type { Article, ContentBlock, Thesis, ThesisStatus, UpdateThesisPayload } from '../types'
import { THESIS_STATUS_LABEL_ZH } from '../utils/articleUtils'

interface ThesisDetailViewProps {
  thesis: Thesis
  articles: Article[]
  onBack: () => void
  onOpenArticle: (id: string) => void
  onUpdate: (thesisId: string, patch: UpdateThesisPayload) => Promise<void>
  onDelete: (thesisId: string, title: string) => Promise<void>
  onLinkArticle: (thesisId: string, articleId: string) => Promise<void>
  onUnlinkArticle: (thesisId: string, articleId: string) => Promise<void>
  onAddTextBlock: (thesisId: string, sectionId: string, content: string, description?: string) => Promise<void>
  onUpdateTextBlock: (thesisId: string, blockId: string, content: string, description?: string) => Promise<void>
  onDeleteBlock: (thesisId: string, blockId: string) => Promise<void>
  onExportMarkdown: (thesisId: string) => Promise<void>
}

const THESIS_STATUSES: ThesisStatus[] = ['Proposal', 'InProgress', 'DefenseReady', 'Defended', 'Revised', 'Final']

function splitKeywords(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function ThesisDetailView({
  thesis,
  articles,
  onBack,
  onOpenArticle,
  onUpdate,
  onDelete,
  onLinkArticle,
  onUnlinkArticle,
  onAddTextBlock,
  onUpdateTextBlock,
  onDeleteBlock,
  onExportMarkdown,
}: ThesisDetailViewProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Required<UpdateThesisPayload>>({
    title: thesis.title,
    titleEn: thesis.titleEn ?? '',
    author: thesis.author,
    supervisor: thesis.supervisor,
    institution: thesis.institution,
    department: thesis.department,
    degree: thesis.degree,
    status: thesis.status,
    abstractZh: thesis.abstractZh,
    abstractEn: thesis.abstractEn,
    keywords: thesis.keywords,
  })
  const [keywordsText, setKeywordsText] = useState(thesis.keywords.join(', '))
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, string>>({})
  const [blockDrafts, setBlockDrafts] = useState<Record<string, string>>({})
  const linkedArticles = articles.filter((article) => thesis.articleIds.includes(article.id))
  const availableArticles = articles.filter((article) => !thesis.articleIds.includes(article.id))

  useEffect(() => {
    setDraft({
      title: thesis.title,
      titleEn: thesis.titleEn ?? '',
      author: thesis.author,
      supervisor: thesis.supervisor,
      institution: thesis.institution,
      department: thesis.department,
      degree: thesis.degree,
      status: thesis.status,
      abstractZh: thesis.abstractZh,
      abstractEn: thesis.abstractEn,
      keywords: thesis.keywords,
    })
    setKeywordsText(thesis.keywords.join(', '))
    setBlockDrafts(
      Object.fromEntries(
        thesis.sections.flatMap((section) =>
          section.contentBlocks
            .filter((block): block is ContentBlock => block.type === 'Text')
            .map((block) => [block.id, block.content]),
        ),
      ),
    )
  }, [thesis])

  async function saveDraft() {
    setSaving(true)
    try {
      await onUpdate(thesis.id, { ...draft, keywords: splitKeywords(keywordsText) })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function deleteCurrentThesis() {
    if (!confirm(`确定删除大论文「${thesis.title}」？\n\n这会删除该大论文框架、章节结构和关联信息，但不会删除已关联的小论文。不可撤销。`)) {
      return
    }
    await onDelete(thesis.id, thesis.title)
  }

  return (
    <div className="workspace">
      <header className="workspace-top">
        <button className="ghost-button" type="button" onClick={onBack}>
          返回稿件库
        </button>
        <div className="meta-heading">
          <p className="eyebrow">大论文</p>
          <h2>{thesis.title}</h2>
          <p>{thesis.author || '未填写作者'} · {thesis.institution || '未填写机构'} · {thesis.degree === 'PhD' ? '博士' : '硕士'}</p>
        </div>
        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={() => setEditing((value) => !value)}>
            {editing ? '取消修改' : '修改信息'}
          </button>
          <button className="ghost-button" type="button" onClick={() => onExportMarkdown(thesis.id)}>
            导出 Markdown
          </button>
          <button className="ghost-button danger" type="button" onClick={deleteCurrentThesis}>
            删除大论文
          </button>
        </div>
      </header>

      <section className="panel-stack">
        <section className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Overview</p>
              <h3>大论文信息</h3>
            </div>
          </div>
          {editing ? (
            <div className="panel-stack">
              <div className="form-grid">
                <label className="field">
                  <span>中文题名</span>
                  <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                </label>
                <label className="field">
                  <span>英文题名</span>
                  <input value={draft.titleEn} onChange={(event) => setDraft({ ...draft, titleEn: event.target.value })} />
                </label>
                <label className="field">
                  <span>作者</span>
                  <input value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} />
                </label>
                <label className="field">
                  <span>导师</span>
                  <input value={draft.supervisor} onChange={(event) => setDraft({ ...draft, supervisor: event.target.value })} />
                </label>
                <label className="field">
                  <span>机构</span>
                  <input value={draft.institution} onChange={(event) => setDraft({ ...draft, institution: event.target.value })} />
                </label>
                <label className="field">
                  <span>院系</span>
                  <input value={draft.department} onChange={(event) => setDraft({ ...draft, department: event.target.value })} />
                </label>
                <label className="field">
                  <span>学位</span>
                  <select value={draft.degree} onChange={(event) => setDraft({ ...draft, degree: event.target.value as 'Master' | 'PhD' })}>
                    <option value="Master">硕士</option>
                    <option value="PhD">博士</option>
                  </select>
                </label>
                <label className="field">
                  <span>状态</span>
                  <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ThesisStatus })}>
                    {THESIS_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {THESIS_STATUS_LABEL_ZH[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>中文摘要</span>
                <textarea value={draft.abstractZh} onChange={(event) => setDraft({ ...draft, abstractZh: event.target.value })} />
              </label>
              <label className="field">
                <span>英文摘要</span>
                <textarea value={draft.abstractEn} onChange={(event) => setDraft({ ...draft, abstractEn: event.target.value })} />
              </label>
              <label className="field">
                <span>关键词</span>
                <input value={keywordsText} onChange={(event) => setKeywordsText(event.target.value)} placeholder="用逗号分隔" />
              </label>
              <div className="header-actions">
                <button className="primary-button" type="button" onClick={saveDraft} disabled={saving}>
                  {saving ? '保存中...' : '保存大论文信息'}
                </button>
              </div>
            </div>
          ) : (
            <div className="form-grid">
              <label className="field">
                <span>导师</span>
                <input value={thesis.supervisor || '未填写'} readOnly />
              </label>
              <label className="field">
                <span>院系</span>
                <input value={thesis.department || '未填写'} readOnly />
              </label>
              <label className="field">
                <span>状态</span>
                <input value={THESIS_STATUS_LABEL_ZH[thesis.status]} readOnly />
              </label>
              <label className="field">
                <span>关键词</span>
                <input value={thesis.keywords.join(', ') || '未填写'} readOnly />
              </label>
            </div>
          )}
        </section>

        <section className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Sections</p>
              <h3>章节结构</h3>
            </div>
          </div>
          <div className="plain-list">
            {thesis.sections.map((section) => (
              <div key={section.id} className="revision-item">
                <div style={{ width: '100%' }}>
                  <strong>{section.title}</strong>
                  <p>{section.contentBlocks.length} 个内容块</p>
                  <label className="field" style={{ marginTop: 'var(--sp-3)' }}>
                    <span>追加正文</span>
                    <textarea
                      rows={4}
                      value={sectionDrafts[section.id] ?? ''}
                      onChange={(event) => setSectionDrafts({ ...sectionDrafts, [section.id]: event.target.value })}
                      placeholder="写入这个大论文章节的正文..."
                    />
                  </label>
                  <div className="header-actions">
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={!sectionDrafts[section.id]?.trim()}
                      onClick={async () => {
                        await onAddTextBlock(thesis.id, section.id, sectionDrafts[section.id] ?? '', `大论文: ${section.title}`)
                        setSectionDrafts({ ...sectionDrafts, [section.id]: '' })
                      }}
                    >
                      添加到章节
                    </button>
                  </div>
                  {section.contentBlocks.length > 0 ? (
                    <div className="plain-list" style={{ marginTop: 'var(--sp-3)' }}>
                      {section.contentBlocks.map((block) => (
                        <div key={block.id} className="revision-item">
                          {block.type === 'Text' ? (
                            <div style={{ width: '100%' }}>
                              <label className="field">
                                <span>{block.description || '文本块'}</span>
                                <textarea
                                  rows={4}
                                  value={blockDrafts[block.id] ?? block.content}
                                  onChange={(event) => setBlockDrafts({ ...blockDrafts, [block.id]: event.target.value })}
                                />
                              </label>
                              <div className="header-actions">
                                <button
                                  className="ghost-button"
                                  type="button"
                                  onClick={() => onUpdateTextBlock(thesis.id, block.id, blockDrafts[block.id] ?? block.content, block.description)}
                                >
                                  保存文本块
                                </button>
                                <button
                                  className="ghost-button danger"
                                  type="button"
                                  onClick={() => {
                                    if (confirm('确定删除这个大论文章节文本块？')) onDeleteBlock(thesis.id, block.id)
                                  }}
                                >
                                  删除文本块
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p>{block.description || '非文本内容块'}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Linked Small Papers</p>
              <h3>关联小论文</h3>
            </div>
          </div>
          {linkedArticles.length === 0 ? (
            <p className="empty-text">还没有关联小论文。可以从下方把小论文组织进大论文。</p>
          ) : (
            <div className="plain-list">
              {linkedArticles.map((article) => (
                <div key={article.id} className="revision-item">
                  <div>
                    <strong>{article.title}</strong>
                    <p>{article.targetJournal || '未填写期刊'}</p>
                  </div>
                  <div className="header-actions">
                    <button className="ghost-button" type="button" onClick={() => onOpenArticle(article.id)}>
                      打开小论文
                    </button>
                    <button className="ghost-button" type="button" onClick={() => onUnlinkArticle(thesis.id, article.id)}>
                      取消关联
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {availableArticles.length > 0 ? (
            <div className="panel-stack">
              <p className="muted-text">可关联的小论文</p>
              <div className="plain-list">
                {availableArticles.map((article) => (
                  <div key={article.id} className="revision-item">
                    <div>
                      <strong>{article.title}</strong>
                      <p>{article.targetJournal || '未填写期刊'}</p>
                    </div>
                    <button className="ghost-button" type="button" onClick={() => onLinkArticle(thesis.id, article.id)}>
                      关联到大论文
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </div>
  )
}

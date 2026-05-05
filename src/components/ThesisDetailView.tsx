import type { Article, Thesis } from '../types'

interface ThesisDetailViewProps {
  thesis: Thesis
  articles: Article[]
  onBack: () => void
  onOpenArticle: (id: string) => void
}

export function ThesisDetailView({ thesis, articles, onBack, onOpenArticle }: ThesisDetailViewProps) {
  const linkedArticles = articles.filter((article) => thesis.articleIds.includes(article.id))
  return (
    <div className="workspace">
      <header className="workspace-top">
        <button className="ghost-button" type="button" onClick={onBack}>
          返回 Library
        </button>
        <div className="meta-heading">
          <p className="eyebrow">Thesis</p>
          <h2>{thesis.title}</h2>
          <p>{thesis.author || '未填写作者'} · {thesis.institution || '未填写机构'} · {thesis.degree === 'PhD' ? '博士' : '硕士'}</p>
        </div>
      </header>

      <section className="panel-stack">
        <section className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Overview</p>
              <h3>学位论文信息</h3>
            </div>
          </div>
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
              <span>关键词</span>
              <input value={thesis.keywords.join(', ') || '未填写'} readOnly />
            </label>
          </div>
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
                <strong>{section.title}</strong>
                <p>{section.contentBlocks.length} 个内容块</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Linked Articles</p>
              <h3>关联小论文</h3>
            </div>
          </div>
          {linkedArticles.length === 0 ? (
            <p className="empty-text">还没有关联文章。后续可以从这里把小论文组织进学位论文。</p>
          ) : (
            <div className="plain-list">
              {linkedArticles.map((article) => (
                <button key={article.id} className="revision-item" type="button" onClick={() => onOpenArticle(article.id)}>
                  <strong>{article.title}</strong>
                  <p>{article.targetJournal || '未填写期刊'}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}

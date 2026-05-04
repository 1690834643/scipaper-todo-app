import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CreateArticlePayload } from '../types'

interface ArticleWizardProps {
  open: boolean
  busy: boolean
  onClose: () => void
  onSubmit: (payload: CreateArticlePayload) => Promise<void>
}

const STEP_LABELS = ['基础信息', '科学问题', '观察现象', '研究假设', '执行方案', '确认创建']

const EMPTY_FORM: CreateArticlePayload = {
  title: '',
  targetJournal: '',
  status: 'Drafting',
  language: 'en',
  researchContext: {
    scientificQuestion: '',
    observedPhenomenon: '',
    hypothesis: '',
    approach: '',
  },
}

export function ArticleWizard({ open, busy, onClose, onSubmit }: ArticleWizardProps) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CreateArticlePayload>(EMPTY_FORM)

  useEffect(() => {
    if (open) {
      setStep(0)
      setForm(EMPTY_FORM)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) {
    return null
  }

  const canAdvance =
    step === 0 ||
    (step === 1 && form.researchContext.scientificQuestion.trim()) ||
    (step === 2 && form.researchContext.observedPhenomenon.trim()) ||
    (step === 3 && form.researchContext.hypothesis.trim()) ||
    (step === 4 && form.researchContext.approach.trim()) ||
    step === 5

  async function handleSubmit() {
    await onSubmit(form)
  }

  return createPortal(
    <div className="modal-overlay" role="presentation">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">开始你的新研究</p>
            <h2>科研论文创建向导</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>

        <div className="wizard-progress">
          {STEP_LABELS.map((label, index) => (
            <div key={label} className={`wizard-step ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`}>
              <span>{index + 1}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>

        <div className="wizard-stage">
          {step === 0 && (
            <div className="form-grid">
              <label className="field">
                <span>文章标题</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="例如：XX 蛋白调控 YY 通路的新机制"
                />
              </label>
              <label className="field">
                <span>目标期刊</span>
                <input
                  value={form.targetJournal}
                  onChange={(event) => setForm({ ...form, targetJournal: event.target.value })}
                  placeholder="例如：Nature Cell Biology"
                />
              </label>
              <label className="field">
                <span>论文写作语言</span>
                <div className="inline-actions">
                  <label className="radio-pill">
                    <input
                      type="radio"
                      name="article-language"
                      value="en"
                      checked={form.language !== 'zh'}
                      onChange={() => setForm({ ...form, language: 'en' })}
                    />
                    <span>英文 (SCI)</span>
                  </label>
                  <label className="radio-pill">
                    <input
                      type="radio"
                      name="article-language"
                      value="zh"
                      checked={form.language === 'zh'}
                      onChange={() => setForm({ ...form, language: 'zh' })}
                    />
                    <span>中文</span>
                  </label>
                </div>
                <small style={{ color: 'var(--c-ink-faint)', fontSize: 'var(--fs-xs)', marginTop: '4px' }}>
                  AI 助手永远用中文跟你交流，但批注与示范句会按所选语言给。
                </small>
              </label>
              <div className="form-tip">
                <p>这里允许先留空。真正必填的是后面的 4 个研究问题。</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <label className="field">
              <span>你想解决什么科学问题？</span>
              <textarea
                rows={8}
                value={form.researchContext.scientificQuestion}
                onChange={(event) =>
                  setForm({
                    ...form,
                    researchContext: {
                      ...form.researchContext,
                      scientificQuestion: event.target.value,
                    },
                  })
                }
                placeholder="例如：XX 蛋白是否通过 WW 复合体调控 YY 信号通路？"
              />
            </label>
          )}

          {step === 2 && (
            <label className="field">
              <span>你发现了什么科学现象？</span>
              <textarea
                rows={8}
                value={form.researchContext.observedPhenomenon}
                onChange={(event) =>
                  setForm({
                    ...form,
                    researchContext: {
                      ...form.researchContext,
                      observedPhenomenon: event.target.value,
                    },
                  })
                }
                placeholder="例如：敲除 XX 后细胞迁移明显下降，但增殖没有显著变化。"
              />
            </label>
          )}

          {step === 3 && (
            <label className="field">
              <span>你的假设是什么？</span>
              <textarea
                rows={8}
                value={form.researchContext.hypothesis}
                onChange={(event) =>
                  setForm({
                    ...form,
                    researchContext: {
                      ...form.researchContext,
                      hypothesis: event.target.value,
                    },
                  })
                }
                placeholder="例如：XX 通过调控 WW 的定位影响 YY 通路活性。"
              />
            </label>
          )}

          {step === 4 && (
            <label className="field">
              <span>你准备怎么做？</span>
              <textarea
                rows={8}
                value={form.researchContext.approach}
                onChange={(event) =>
                  setForm({
                    ...form,
                    researchContext: {
                      ...form.researchContext,
                      approach: event.target.value,
                    },
                  })
                }
                placeholder="例如：CRISPR 敲除 + RNA-seq + 共免 + 恢复实验"
              />
            </label>
          )}

          {step === 5 && (
            <div className="wizard-confirm">
              <div className="confirm-card">
                <h3>即将生成的固定骨架</h3>
                <ul className="tag-list">
                  <li>Title</li>
                  <li>Abstract</li>
                  <li>Introduction</li>
                  <li>Materials & Methods</li>
                  <li>Results</li>
                  <li>Discussion</li>
                  <li>References</li>
                </ul>
              </div>

              <div className="confirm-card">
                <h3>创建后会保留的信息</h3>
                <ul className="plain-list">
                  <li>4 个研究问题会作为研究上下文保存</li>
                  <li>自动建立文章目录、附件目录和导出目录</li>
                  <li>后续可通过 MCP 持续写入文本、图片、PDF 和审稿记录</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="ghost-button" disabled={step === 0 || busy} onClick={() => setStep(step - 1)} type="button">
            上一步
          </button>
          {step < 5 ? (
            <button className="primary-button" disabled={!canAdvance || busy} onClick={() => setStep(step + 1)} type="button">
              下一步
            </button>
          ) : (
            <button className="primary-button" disabled={busy} onClick={handleSubmit} type="button">
              {busy ? '创建中...' : '创建文章'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CreateThesisPayload } from '../types'

interface ThesisWizardProps {
  open: boolean
  busy: boolean
  onClose: () => void
  onSubmit: (payload: CreateThesisPayload) => Promise<void>
}

const STEP_LABELS = ['基本信息', '作者与导师', '机构信息', '摘要与关键词', '确认创建']

const EMPTY_FORM: CreateThesisPayload = {
  title: '',
  titleEn: '',
  author: '',
  supervisor: '',
  institution: '',
  department: '',
  degree: 'Master',
  abstractZh: '',
  abstractEn: '',
  keywords: [],
}

export function ThesisWizard({ open, busy, onClose, onSubmit }: ThesisWizardProps) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CreateThesisPayload>(EMPTY_FORM)
  const [keywordInput, setKeywordInput] = useState('')

  useEffect(() => {
    if (open) {
      setStep(0)
      setForm(EMPTY_FORM)
      setKeywordInput('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  function addKeyword() {
    const keyword = keywordInput.trim()
    if (keyword && !form.keywords.includes(keyword)) {
      setForm({ ...form, keywords: [...form.keywords, keyword] })
      setKeywordInput('')
    }
  }

  function removeKeyword(keyword: string) {
    setForm({ ...form, keywords: form.keywords.filter(k => k !== keyword) })
  }

  const canAdvance =
    (step === 0 && form.title.trim()) ||
    (step === 1 && form.author.trim() && form.supervisor.trim()) ||
    (step === 2 && form.institution.trim() && form.department.trim()) ||
    step === 3 ||
    step === 4

  return createPortal(
    <div className="modal-overlay" role="presentation">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">创建学位论文</p>
            <h2>学位论文创建向导</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>

        <div className="wizard-progress">
          {STEP_LABELS.map((label, index) => (
            <div
              key={label}
              className={`wizard-step ${index === step ? 'active' : ''} ${index < step ? 'completed' : ''}`}
            >
              <span>{index + 1}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>

        <div className="wizard-stage">
          {step === 0 && (
            <div className="form-grid">
              <label className="field">
                <span>中文标题 *</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="例如：基于深度学习的图像识别研究"
                />
              </label>
              <label className="field">
                <span>英文标题</span>
                <input
                  value={form.titleEn}
                  onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                  placeholder="例如：Image Recognition Based on Deep Learning"
                />
              </label>
              <label className="field">
                <span>学位类型</span>
                <select
                  value={form.degree}
                  onChange={(e) => setForm({ ...form, degree: e.target.value as 'Master' | 'PhD' })}
                >
                  <option value="Master">硕士</option>
                  <option value="PhD">博士</option>
                </select>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="form-grid">
              <label className="field">
                <span>作者 *</span>
                <input
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="你的姓名"
                />
              </label>
              <label className="field">
                <span>导师 *</span>
                <input
                  value={form.supervisor}
                  onChange={(e) => setForm({ ...form, supervisor: e.target.value })}
                  placeholder="导师姓名"
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="form-grid">
              <label className="field">
                <span>学校/机构 *</span>
                <input
                  value={form.institution}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  placeholder="例如：北京大学"
                />
              </label>
              <label className="field">
                <span>院系 *</span>
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="例如：计算机科学与技术学院"
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="field">
                <span>中文摘要</span>
                <textarea
                  rows={4}
                  value={form.abstractZh}
                  onChange={(e) => setForm({ ...form, abstractZh: e.target.value })}
                  placeholder="论文的中文摘要..."
                />
              </label>
              <label className="field">
                <span>英文摘要</span>
                <textarea
                  rows={4}
                  value={form.abstractEn}
                  onChange={(e) => setForm({ ...form, abstractEn: e.target.value })}
                  placeholder="Abstract in English..."
                />
              </label>
              <label className="field">
                <span>关键词</span>
                <div className="keyword-input-row">
                  <input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="输入关键词后按添加"
                    onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  />
                  <button className="ghost-button" onClick={addKeyword} type="button">
                    添加
                  </button>
                </div>
                <div className="keyword-list">
                  {form.keywords.map((keyword) => (
                    <span key={keyword} className="keyword-tag">
                      {keyword}
                      <button onClick={() => removeKeyword(keyword)}>×</button>
                    </span>
                  ))}
                </div>
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="wizard-confirm">
              <div className="confirm-card">
                <h3>即将创建的学位论文</h3>
                <div className="confirm-info">
                  <p><strong>标题：</strong>{form.title || '未填写'}</p>
                  <p><strong>作者：</strong>{form.author}</p>
                  <p><strong>导师：</strong>{form.supervisor}</p>
                  <p><strong>机构：</strong>{form.institution}</p>
                  <p><strong>学位：</strong>{form.degree === 'Master' ? '硕士' : '博士'}</p>
                </div>
              </div>
              <div className="confirm-card">
                <h3>默认章节结构</h3>
                <ul className="tag-list">
                  <li>封面</li>
                  <li>声明</li>
                  <li>摘要</li>
                  <li>致谢</li>
                  <li>目录</li>
                  <li>第一章 绪论</li>
                  <li>结论</li>
                  <li>参考文献</li>
                  <li>附录</li>
                </ul>
                <p className="form-tip">创建后可以添加更多章节，并关联已有的小论文</p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="ghost-button"
            disabled={step === 0 || busy}
            onClick={() => setStep(step - 1)}
            type="button"
          >
            上一步
          </button>
          {step < 4 ? (
            <button
              className="primary-button"
              disabled={!canAdvance || busy}
              onClick={() => setStep(step + 1)}
              type="button"
            >
              下一步
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => onSubmit(form)}
              type="button"
            >
              {busy ? '创建中...' : '创建学位论文'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

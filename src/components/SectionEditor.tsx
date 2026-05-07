import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import UTIF from 'utif'
import { DiffViewer } from './DiffViewer'
import type { Article, BlockPreview, ContentBlock, Section, Finding, FindingStatus } from '../types'
import { stripHtml } from '../utils/htmlContent'
import { countWords } from '../utils/wordCounter'

// Section view is a permanent preview surface (sprint 6 阶段 8.5).
// All text writing happens in FocusModeEditor; this component only displays
// existing blocks, asset previews, and findings. The "✨ 沉浸式编辑" / "✨ 沉浸式
// 撰写" buttons are the only ways into text editing from here.
interface SectionEditorProps {
  article: Article
  section: Section
  onDeleteBlock: (blockId: string) => Promise<void>
  onOpenAsset: (blockId: string) => Promise<void>
  onAddImage?: () => Promise<void>
  onAddFile?: () => Promise<void>
  onAddFinding?: (title: string) => Promise<void>
  onUpdateFinding?: (findingId: string, patch: { title?: string; status?: FindingStatus }) => Promise<void>
  onDeleteFinding?: (findingId: string) => Promise<void>
  /** Click on the manuscript text block → host should switch to immersive
   *  writing. Wired by App.tsx to the focus-mode viewMode setter. */
  onEnterEdit?: () => void
}

const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  planned: '待办',
  inProgress: '进行中',
  done: '已完成',
}

function FindingsPanel({
  findings,
  onAdd,
  onUpdate,
  onDelete,
}: {
  findings: Finding[]
  onAdd: (title: string) => Promise<void>
  onUpdate: (findingId: string, patch: { title?: string; status?: FindingStatus }) => Promise<void>
  onDelete: (findingId: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleAdd() {
    const title = draft.trim()
    if (!title || submitting) return
    setSubmitting(true)
    try {
      await onAdd(title)
      setDraft('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='findings-panel'>
      <div className='findings-panel-header'>
        <h3 className='findings-panel-title'>结果小点 (Findings)</h3>
        <span className='findings-panel-count'>{findings.length}</span>
      </div>
      <p className='findings-panel-hint'>
        把 Result 拆成可挂的小点：实验、阅读、分析这些进展条目都可以挂到下面。
      </p>
      <ul className='findings-list'>
        {findings.map((finding) => (
          <li key={finding.id} className={`finding-item finding-${finding.status}`}>
            <select
              value={finding.status}
              onChange={(e) => void onUpdate(finding.id, { status: e.target.value as FindingStatus })}
              className='finding-status-select'
            >
              {(Object.keys(FINDING_STATUS_LABEL) as FindingStatus[]).map((s) => (
                <option key={s} value={s}>
                  {FINDING_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <span className='finding-title'>{finding.title}</span>
            <button
              type='button'
              className='finding-delete'
              aria-label='删除小点'
              onClick={() => void onDelete(finding.id)}
            >
              ×
            </button>
          </li>
        ))}
        {findings.length === 0 ? (
          <li className='finding-empty'>还没有 finding。在下面输入框写一条。</li>
        ) : null}
      </ul>
      <div className='findings-add'>
        <input
          type='text'
          className='findings-add-input'
          placeholder='例如：Sf9 piRNA 在病毒侵染时上调'
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleAdd()
            }
          }}
        />
        <button
          type='button'
          className='ghost-button'
          onClick={() => void handleAdd()}
          disabled={!draft.trim() || submitting}
        >
          + 加 finding
        </button>
      </div>
    </div>
  )
}

function formatFileSize(size?: number | null) {
  if (!size) {
    return '未知大小'
  }

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getPreviewSummary(block: ContentBlock) {
  const text = stripHtml(block.content).replace(/\s+/g, ' ').trim()
  return text.length > 240 ? `${text.slice(0, 240)}...` : text
}

function buildTiffPreview(bufferBase64: string) {
  const binary = atob(bufferBase64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const ifds = UTIF.decode(bytes.buffer)

  if (!ifds.length) {
    return null
  }

  UTIF.decodeImage(bytes.buffer, ifds[0])
  const rgba = UTIF.toRGBA8(ifds[0])
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  canvas.width = ifds[0].width
  canvas.height = ifds[0].height
  const imageData = new ImageData(new Uint8ClampedArray(rgba), canvas.width, canvas.height)
  context.putImageData(imageData, 0, 0)

  return canvas.toDataURL('image/png')
}

function buildBlobUrl(bufferBase64: string, mimeType: string) {
  const binary = atob(bufferBase64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

function AssetPreviewModal({
  block,
  preview,
  error,
  onClose,
  onOpenAsset,
}: {
  block: ContentBlock
  preview: BlockPreview | null
  error: string
  onClose: () => void
  onOpenAsset: () => Promise<void>
}) {
  const [tiffDataUrl, setTiffDataUrl] = useState<string | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (preview?.previewKind === 'tiff' && preview.bufferBase64) {
      setTiffDataUrl(buildTiffPreview(preview.bufferBase64))
    } else {
      setTiffDataUrl(null)
    }
  }, [preview])

  useEffect(() => {
    if (preview?.previewKind !== 'pdf' || !preview.bufferBase64) {
      setPdfBlobUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl)
        }
        return null
      })
      return
    }

    const nextUrl = buildBlobUrl(preview.bufferBase64, 'application/pdf')
    setPdfBlobUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
      return nextUrl
    })

    return () => {
      URL.revokeObjectURL(nextUrl)
    }
  }, [preview])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useLayoutEffect(() => {
    backdropRef.current?.scrollTo({ top: 0, left: 0 })
    modalRef.current?.scrollTo({ top: 0, left: 0 })
  }, [block.id, preview?.path, preview?.previewKind, pdfBlobUrl, error])

  const pdfViewerUrl = pdfBlobUrl ? `${pdfBlobUrl}#page=1&view=FitH` : null

  return createPortal(
    <div className="modal-overlay" ref={backdropRef} role="presentation">
      <div className="modal-dialog modal-dialog--wide preview-modal" ref={modalRef}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">附件预览</p>
            <h2>{preview?.fileName || block.fileName || '未命名附件'}</h2>
            <p className="modal-subtitle">
              来源 {block.updatedBy || block.createdBy || '未知'} · 更新于 {formatDate(block.updatedAt)}
            </p>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </div>

        <div className="preview-stage">
          {!preview && !error ? (
            <div className="empty-panel">
              <h3>正在准备预览</h3>
              <p>正在读取附件内容，请稍候。</p>
            </div>
          ) : null}
          {error ? (
            <div className="empty-panel">
              <h3>预览失败</h3>
              <p>{error}</p>
            </div>
          ) : null}
          {preview?.previewKind === 'image' ? (
            <img className="preview-image" src={block.previewUrl || ''} alt={block.fileName || block.description || '附件预览'} />
          ) : null}
          {preview?.previewKind === 'pdf' && pdfViewerUrl ? (
            <iframe className="preview-frame" key={pdfViewerUrl} src={pdfViewerUrl} title={preview.fileName} />
          ) : null}
          {preview?.previewKind === 'tiff' && tiffDataUrl ? (
            <img className="preview-image" src={tiffDataUrl} alt={preview.fileName} />
          ) : null}
          {!error &&
          (preview?.previewKind === 'none' ||
            (!tiffDataUrl && preview?.previewKind === 'tiff') ||
            (!pdfBlobUrl && preview?.previewKind === 'pdf')) ? (
            <div className="empty-panel">
              <h3>当前不支持内嵌预览</h3>
              <p>这个文件类型会保存在项目目录里，你可以直接用系统默认程序打开。</p>
            </div>
          ) : null}
        </div>

        <div className="modal-footer">
          <div className="asset-meta">
            <p>{block.description}</p>
            <p>{formatFileSize(block.fileSize)}</p>
            <p>{block.resolvedPath || '文件不存在'}</p>
          </div>
          <button className="primary-button" onClick={onOpenAsset} type="button">
            用系统程序打开
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function SectionEditor({
  article,
  section,
  onDeleteBlock,
  onOpenAsset,
  onAddImage,
  onAddFile,
  onAddFinding,
  onUpdateFinding,
  onDeleteFinding,
  onEnterEdit,
}: SectionEditorProps) {
  const [previewBlock, setPreviewBlock] = useState<ContentBlock | null>(null)
  const [previewPayload, setPreviewPayload] = useState<BlockPreview | null>(null)
  const [previewError, setPreviewError] = useState('')
  // Per-block expanded / version-visible state for the design pack §①
  // ManuscriptCard footer affordances. IDs are stored as strings.
  const [expandedBlockIds, setExpandedBlockIds] = useState<Set<string>>(new Set())
  const [versionsVisibleIds, setVersionsVisibleIds] = useState<Set<string>>(new Set())
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null)

  useEffect(() => {
    setPreviewBlock(null)
    setPreviewPayload(null)
    setPreviewError('')
    setExpandedBlockIds(new Set())
    setVersionsVisibleIds(new Set())
    setCopiedBlockId(null)
  }, [section.id])

  function toggleBlockExpanded(id: string) {
    setExpandedBlockIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleBlockVersions(id: string) {
    setVersionsVisibleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  async function copyBlockText(block: ContentBlock) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(stripHtml(block.content || ''))
      setCopiedBlockId(block.id)
      setTimeout(() => setCopiedBlockId((cur) => (cur === block.id ? null : cur)), 1500)
    } catch {
      // Clipboard write can fail in restricted contexts; user still has UI cues.
    }
  }

  async function handlePreview(block: ContentBlock) {
    setPreviewBlock(block)
    setPreviewPayload(null)
    setPreviewError('')

    try {
      const payload = await window.scipaper.getBlockPreview(article.id, block.id)
      setPreviewPayload(payload)
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : '附件预览失败')
    }
  }

  const showFindings = section.type === 'Results' && onAddFinding && onUpdateFinding && onDeleteFinding

  return (
    <div className="panel-stack">
      {showFindings ? (
        <FindingsPanel
          findings={section.findings || []}
          onAdd={onAddFinding}
          onUpdate={onUpdateFinding}
          onDelete={onDeleteFinding}
        />
      ) : null}

      {previewBlock ? (
        <AssetPreviewModal
          block={previewBlock}
          preview={previewPayload}
          error={previewError}
          onClose={() => {
            setPreviewBlock(null)
            setPreviewPayload(null)
            setPreviewError('')
          }}
          onOpenAsset={async () => {
            await onOpenAsset(previewBlock.id)
          }}
        />
      ) : null}

      {/* PreviewCard — design pack §① Manuscript Dashboard.
          Stats grid + two-line "进入写作" button + image/file/text 连体添加. */}
      <section className="composer-card preview-card">
        <div className="section-heading preview-head">
          <div className="preview-meta">
            <h3 className="preview-title">{section.type}</h3>
            <p className="preview-sub">
              点
              <span className="kbd-inline">⌘E</span>
              或下方手稿卡片进入写作。本页只展示文本/图片/PDF/备份。
            </p>
          </div>
          <div className="preview-actions">
            {onEnterEdit ? (
              <button
                className="enter-writing"
                onClick={() => onEnterEdit()}
                type="button"
                title="进入沉浸式写作"
              >
                <span className="ew-text">
                  <span className="ew-label">进入写作</span>
                  <span className="ew-sub">Focus mode · {section.type}</span>
                </span>
                <span className="ew-right">
                  <span className="ew-kbd">
                    <span className="kbd-inline">⌘</span>
                    <span className="kbd-inline">E</span>
                  </span>
                  <span className="ew-arrow" aria-hidden>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </span>
                </span>
              </button>
            ) : null}
            {onAddImage || onAddFile ? (
              <div className="add-row" role="group" aria-label="添加素材">
                {onAddImage ? (
                  <button className="add-btn" type="button" onClick={onAddImage}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                    <span>图片</span>
                  </button>
                ) : null}
                {onAddImage && onAddFile ? <span className="add-sep" aria-hidden /> : null}
                {onAddFile ? (
                  <button className="add-btn" type="button" onClick={onAddFile}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                    </svg>
                    <span>文件</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="preview-stats">
          {(() => {
            const textBlocks = section.contentBlocks.filter((b) => b.type === 'Text')
            const imageBlocks = section.contentBlocks.filter((b) => b.type === 'Image')
            const fileBlocks = section.contentBlocks.filter((b) => b.type === 'FileLink')
            const totalWords = textBlocks.reduce((sum, b) => sum + countWords(b.content), 0)
            const totalVersions = textBlocks.reduce((sum, b) => sum + (b.versions?.length || 0), 0)
            const lastUpdate = section.contentBlocks
              .map((b) => b.updatedAt)
              .filter(Boolean)
              .sort()
              .pop()
            return (
              <>
                <div className="stat">
                  <span className="stat-label">字数</span>
                  <span className="stat-value">{totalWords.toLocaleString()}</span>
                  <span className="stat-trend muted">
                    {textBlocks.length > 0
                      ? `${textBlocks.length} 个文本块`
                      : '未开始'}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">手稿块</span>
                  <span className="stat-value">{section.contentBlocks.length}</span>
                  <span className="stat-trend muted">
                    {lastUpdate ? `最近 ${formatDate(lastUpdate)}` : '无活动'}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">附件</span>
                  <span className="stat-value">{imageBlocks.length + fileBlocks.length}</span>
                  <span className="stat-trend muted">
                    {imageBlocks.length > 0 || fileBlocks.length > 0
                      ? `图片 ${imageBlocks.length} · 文件 ${fileBlocks.length}`
                      : '尚未导入'}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">版本</span>
                  <span className="stat-value">{totalVersions}</span>
                  <span className="stat-trend muted">
                    {totalVersions > 0 ? '自动 + 手动快照' : '尚无快照'}
                  </span>
                </div>
              </>
            )
          })()}
        </div>
      </section>

      {section.contentBlocks.length === 0 ? (
        <section className="empty-panel">
          <h3>这个章节还没有内容</h3>
          <p>
            {onEnterEdit ? (
              <>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onEnterEdit()}
                  style={{ marginRight: '8px' }}
                >
                  ✨ 开始写作
                </button>
                或导入图片 / PDF 等附件。
              </>
            ) : (
              '导入图片 / PDF 等附件来开始这一章。'
            )}
          </p>
        </section>
      ) : (
        section.contentBlocks.map((block) => {
          if (block.type === 'Text') {
            const enterable = !!onEnterEdit
            return (
              <article
                key={block.id}
                className={`content-card text-summary-card${enterable ? ' is-enterable' : ''}`}
                onClick={enterable ? (e) => {
                  // Don't trigger when the click landed on an action button or
                  // a nested DiffViewer interactive element.
                  const tag = (e.target as HTMLElement).closest('button, a')
                  if (tag) return
                  onEnterEdit?.()
                } : undefined}
                role={enterable ? 'button' : undefined}
                tabIndex={enterable ? 0 : undefined}
                onKeyDown={enterable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onEnterEdit?.()
                  }
                } : undefined}
                title={enterable ? '点击进入沉浸式写作' : undefined}
              >
                <div className="content-card-header ms-card-head">
                  <div>
                    <strong className="ms-card-title">{block.description || '未命名文本块'}</strong>
                    <p className="ms-card-meta muted-text">
                      {formatDate(block.updatedAt)} · {countWords(block.content)} 字
                    </p>
                  </div>
                  <div className="inline-actions ms-card-actions">
                    <button
                      className="icon-button"
                      type="button"
                      title={copiedBlockId === block.id ? '已复制' : '复制纯文本'}
                      aria-label="复制"
                      onClick={(e) => {
                        e.stopPropagation()
                        void copyBlockText(block)
                      }}
                    >
                      {copiedBlockId === block.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                          <rect x="9" y="9" width="11" height="11" rx="2" />
                          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                        </svg>
                      )}
                    </button>
                    <button
                      className="icon-button icon-button--danger"
                      type="button"
                      title="删除"
                      aria-label="删除"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteBlock(block.id)
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                </div>

                <p className="text-block-preview ms-body">
                  {expandedBlockIds.has(block.id)
                    ? stripHtml(block.content)
                    : getPreviewSummary(block)}
                </p>

                {block.versions.length > 0 ? (
                  <section className="version-strip" aria-label="版本历史">
                    <header className="version-strip-head">
                      <span className="eyebrow muted">version history</span>
                      <span className="version-strip-count">
                        {block.versions.length} 个快照
                      </span>
                    </header>
                    <ol className="version-strip-list">
                      <li className="version-strip-item is-current">
                        <span className="v-n">v{block.versions.length + 1}</span>
                        <span className="v-time">当前</span>
                        <span className="v-author">编辑中</span>
                        <span className="v-words">{countWords(block.content)} 字</span>
                        <span className="chip">当前</span>
                      </li>
                      {block.versions.slice(0, 4).map((version, vIdx) => {
                        const versionNumber = block.versions.length - vIdx
                        return (
                          <li key={version.id} className="version-strip-item">
                            <span className="v-n">v{versionNumber}</span>
                            <span className="v-time">{formatDate(version.modifiedAt)}</span>
                            <span className="v-author">
                              {version.modifiedBy === 'ai' ? 'AI' : version.modifiedBy || '手动'}
                            </span>
                            <span className="v-words">{countWords(version.content)} 字</span>
                            {version.changeDescription ? (
                              <span className="v-desc" title={version.changeDescription}>
                                {version.changeDescription}
                              </span>
                            ) : null}
                          </li>
                        )
                      })}
                      {block.versions.length > 4 ? (
                        <li className="version-strip-more">
                          + {block.versions.length - 4} 条更早
                        </li>
                      ) : null}
                    </ol>
                  </section>
                ) : null}

                <footer className="ms-card-foot">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleBlockExpanded(block.id)
                    }}
                  >
                    {expandedBlockIds.has(block.id) ? '收起' : '展开全文'}
                  </button>
                  {block.versions.length > 0 ? (
                    <>
                      <span className="dot-sep" aria-hidden>·</span>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleBlockVersions(block.id)
                        }}
                      >
                        {versionsVisibleIds.has(block.id) ? '关闭版本对比' : `查看版本 (${block.versions.length})`}
                      </button>
                    </>
                  ) : null}
                </footer>

                {block.versions.length > 0 && versionsVisibleIds.has(block.id) ? (
                  <DiffViewer
                    versions={block.versions}
                    currentContent={block.content}
                  />
                ) : null}
              </article>
            )
          }

          return (
            <article key={block.id} className="content-card asset-card">
              <div className="content-card-header">
                <div>
                  <p className="eyebrow">{block.type === 'Image' ? '图片附件' : '文件备份'}</p>
                  <strong>{block.fileName || block.description}</strong>
                  <p className="muted-text">
                    来源 {block.updatedBy || block.createdBy || '未知'} · {formatDate(block.updatedAt)}
                  </p>
                </div>
                <div className="inline-actions">
                  <button className="ghost-button" onClick={() => onDeleteBlock(block.id)} type="button">
                    删除
                  </button>
                  <button className="ghost-button" onClick={() => handlePreview(block)} type="button">
                    预览
                  </button>
                  <button className="primary-button" onClick={() => onOpenAsset(block.id)} type="button">
                    打开
                  </button>
                </div>
              </div>

              {block.type === 'Image' && block.previewUrl ? (
                <img className="asset-preview" src={block.previewUrl} alt={block.description || block.fileName || '附件图片'} />
              ) : null}

              <div className="asset-meta">
                <p>{block.description}</p>
                <p>{formatFileSize(block.fileSize)}</p>
                <p>{block.resolvedPath || '文件不存在'}</p>
              </div>
            </article>
          )
        })
      )}
    </div>
  )
}

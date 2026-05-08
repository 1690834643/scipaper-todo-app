// =============================================================================
// FocusFormatToolbar — collapsible drawer below the focus-mode topbar.
//
// Mirrors the design pack writing-page.jsx toolbar (H1-H3 / B I 链接 码 /
// 引用 列表 / 图 表 公式 @cite / 撤销重做). Visual styling lives on
// .focus-mode-toolbar* classes; behavior here.
//
// Editor extension surface (StarterKit + Link + Citation + ...) determines
// which buttons can fully toggle a real schema mark/node vs. fall back to
// inserting plain text. Buttons document their behavior in title=.
// =============================================================================

import type { Editor } from '@tiptap/react'

interface FocusFormatToolbarProps {
  editor: Editor | null
  collapsed: boolean
  /** Optional: when supplied, the Figure button calls this instead of falling
   *  back to a placeholder. The host wires it to the existing image-import
   *  flow so figures land as <Image> blocks like 段落 outside the editor. */
  onInsertImage?: () => void
}

interface ToolBtnProps {
  label?: string
  hint: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children?: React.ReactNode
}

function ToolBtn({ label, hint, active = false, disabled = false, onClick, children }: ToolBtnProps) {
  return (
    <button
      type="button"
      className={`focus-mode-tool${active ? ' is-active' : ''}`}
      title={hint}
      aria-label={hint}
      aria-pressed={active}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault()
        onClick()
      }}
    >
      {children}
      {label ? <span className="focus-mode-tool-label">{label}</span> : null}
    </button>
  )
}

function Divider() {
  return <span className="focus-mode-tool-divider" aria-hidden />
}

// SVG paths copied from the design pack (lucide/feather-style strokes).
const PathBold = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
  </svg>
)
const PathItalic = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M19 4h-9M14 20H5M15 4l-6 16" />
  </svg>
)
const PathLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1" />
  </svg>
)
const PathCode = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
  </svg>
)
const PathQuote = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 21c3 0 5-2 5-6V8H3v7h3M14 21c3 0 5-2 5-6V8h-5v7h3" />
  </svg>
)
const PathList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
)
const PathOL = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c1-1 2-2 2-3a1 1 0 0 0-2 0" />
  </svg>
)
const PathChecklist = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)
const PathImage = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </svg>
)
const PathTable = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
)
const PathFx = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 20s2-4 4-12 4-4 4-4M2 12h10M14 8l8 8M22 8l-8 8" />
  </svg>
)
const PathCite = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M16 9c-1-1-2-1.5-4-1.5S9 9 9 11s1.5 2.5 3 2.5 3 .5 3 2.5-1 2.5-3 2.5-3-.5-4-1.5" />
  </svg>
)
const PathUndo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 7v6h6M3 13a9 9 0 1 0 3-7" />
  </svg>
)
const PathRedo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 7v6h-6M21 13a9 9 0 1 1-3-7" />
  </svg>
)

export function FocusFormatToolbar({ editor, collapsed, onInsertImage }: FocusFormatToolbarProps) {
  if (!editor) {
    const noop = () => {}
    return (
      <div
        className={`focus-mode-toolbar ${collapsed ? 'is-collapsed' : ''}`}
        role="toolbar"
        aria-label="格式工具条"
        aria-hidden={collapsed}
        data-editor-ready="false"
      >
        <ToolBtn label="H1" hint="一级标题" disabled onClick={noop} />
        <ToolBtn label="H2" hint="二级标题" disabled onClick={noop} />
        <ToolBtn label="H3" hint="三级标题" disabled onClick={noop} />
        <Divider />
        <ToolBtn hint="加粗" disabled onClick={noop}><PathBold /></ToolBtn>
        <ToolBtn hint="斜体" disabled onClick={noop}><PathItalic /></ToolBtn>
        <ToolBtn hint="链接" disabled onClick={noop}><PathLink /></ToolBtn>
        <ToolBtn hint="行内代码" disabled onClick={noop}><PathCode /></ToolBtn>
        <Divider />
        <ToolBtn hint="引用块" disabled onClick={noop}><PathQuote /></ToolBtn>
        <ToolBtn hint="无序列表" disabled onClick={noop}><PathList /></ToolBtn>
        <ToolBtn hint="有序列表" disabled onClick={noop}><PathOL /></ToolBtn>
        <ToolBtn hint="任务清单" disabled onClick={noop}><PathChecklist /></ToolBtn>
        <Divider />
        <ToolBtn label="Figure" hint="插入图片占位" disabled onClick={noop}><PathImage /></ToolBtn>
        <ToolBtn label="Table" hint="插入表格占位" disabled onClick={noop}><PathTable /></ToolBtn>
        <ToolBtn label="$$ Eq" hint="插入公式" disabled onClick={noop}><PathFx /></ToolBtn>
        <ToolBtn label="@cite" hint="插入引用" disabled onClick={noop}><PathCite /></ToolBtn>
        <Divider />
        <ToolBtn hint="撤销" disabled onClick={noop}><PathUndo /></ToolBtn>
        <ToolBtn hint="重做" disabled onClick={noop}><PathRedo /></ToolBtn>
      </div>
    )
  }

  const isHeading = (level: 1 | 2 | 3) =>
    editor.isActive('heading', { level })

  const insertLinkPlaceholder = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetMark('link').run()
      return
    }
    const { from, to, empty } = editor.state.selection
    const selectedText = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
    const label = selectedText.trim() || '链接文本'
    editor.chain().focus().insertContent(`[${label}](https://)`).run()
  }

  const insertEquation = () => {
    // No KaTeX node yet — insert the LaTeX delimiters as plain text and place
    // the cursor between them so the user types the formula straight in. A
    // future render pass can convert these to a real Math node.
    editor.chain().focus().insertContent('$$  $$').run()
    const pos = editor.state.selection.from - 3
    editor.commands.setTextSelection({ from: pos, to: pos })
  }

  const insertChecklist = () => {
    // Markdown shortcut. The user can convert with a future TaskList extension
    // without losing their text.
    editor.chain().focus().insertContent('- [ ] ').run()
  }

  const insertCite = () => {
    // Insert `@` to trigger the citation autocomplete branch.
    editor.chain().focus().insertContent('@').run()
  }

  const insertFigurePlaceholder = () => {
    if (onInsertImage) {
      onInsertImage()
      return
    }
    editor.chain().focus().insertContent('\n[Figure: 拖入图片或在 SectionEditor 中"导入图片"]\n').run()
  }

  return (
    <div
      className={`focus-mode-toolbar ${collapsed ? 'is-collapsed' : ''}`}
      role="toolbar"
      aria-label="格式工具条"
      aria-hidden={collapsed}
    >
      <ToolBtn
        label="H1"
        hint="一级标题"
        active={isHeading(1)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolBtn
        label="H2"
        hint="二级标题（⌘⌥2）"
        active={isHeading(2)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolBtn
        label="H3"
        hint="三级标题（⌘⌥3）"
        active={isHeading(3)}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <Divider />
      <ToolBtn
        hint="加粗（⌘B）"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <PathBold />
      </ToolBtn>
      <ToolBtn
        hint="斜体（⌘I）"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <PathItalic />
      </ToolBtn>
      <ToolBtn
        hint="链接"
        active={editor.isActive('link')}
        onClick={insertLinkPlaceholder}
      >
        <PathLink />
      </ToolBtn>
      <ToolBtn
        hint="行内代码"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <PathCode />
      </ToolBtn>
      <Divider />
      <ToolBtn
        hint="引用块"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <PathQuote />
      </ToolBtn>
      <ToolBtn
        hint="无序列表"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <PathList />
      </ToolBtn>
      <ToolBtn
        hint="有序列表"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <PathOL />
      </ToolBtn>
      <ToolBtn
        hint="任务清单（插入 - [ ] ）"
        onClick={insertChecklist}
      >
        <PathChecklist />
      </ToolBtn>
      <Divider />
      <ToolBtn
        label="Figure"
        hint={onInsertImage ? '导入图片到本章节' : '请在章节预览页用"导入图片"'}
        onClick={insertFigurePlaceholder}
      >
        <PathImage />
      </ToolBtn>
      <ToolBtn label="Table" hint="表格（待实现，可手写 markdown）" onClick={() => editor.chain().focus().insertContent('\n| col | col |\n| --- | --- |\n| · | · |\n').run()}>
        <PathTable />
      </ToolBtn>
      <ToolBtn label="$$ Eq" hint="公式占位（$$  $$）" onClick={insertEquation}>
        <PathFx />
      </ToolBtn>
      <ToolBtn label="@cite" hint="引用（弹出引用选择器）" onClick={insertCite}>
        <PathCite />
      </ToolBtn>
      <Divider />
      <ToolBtn
        hint="撤销（⌘Z）"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <PathUndo />
      </ToolBtn>
      <ToolBtn
        hint="重做（⌘⇧Z）"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <PathRedo />
      </ToolBtn>
    </div>
  )
}

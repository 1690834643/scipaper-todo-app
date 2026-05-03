# FocusModeEditor Claude Design 提示词手册

## 1. 设计目标

1. 沉浸大于装饰。打字时界面退后，只剩文字与光标。
2. AI 只能在 margin 发言，不能侵入正文，以人为主导。
3. 零视觉噪音。无闪烁、无弹跳、无多余阴影动画。
4. 安静与放大。字体、行高、页边距都比常规 UI 大一号，营造图书馆桌面感。
5. 三主题自适应。视觉层必须同时服务 claude（暖珊瑚 serif）、pixel（黑白 mono）、fresh（薄荷绿 serif），不硬编码色值。

## 2. CLAUDE_DESIGN / TODO_V2 钩子位清单

| 行号 | 标签 | 当前状态 | 设计方向 |
|------|------|----------|----------|
| L4-7 | CLAUDE_DESIGN | 文件头：语义化 class，最小内联样式 | 保持语义化，不引入内联 style |
| L170 | CLAUDE_DESIGN | Header：section tag + 标题 + 保存状态 + 退出 | 极度克制，像 iA Writer 信息栏，不抢正文视线 |
| L212-214 | CLAUDE_DESIGN | Canvas：textarea 占位 | generous typography，单列 ~720px 居中，大量呼吸空间 |
| L238-239 | CLAUDE_DESIGN | 浮动选择工具条 | v2 跟随光标，像 Medium 浮动条但装饰更少 |
| L249-251 | TODO_V2 | AI 批注占位，直接 addAnnotation | 接入 streaming LLM，使用第 5 节 system prompt |
| L278-279 | CLAUDE_DESIGN | Side rail：批注 + AI chat | 安静的 margin，panel-soft 背景，不抢注意力 |
| L332-334 | CLAUDE_DESIGN | AI chat stub | 紧凑聊天输入框，"只读模式"标签视觉显化 |
| L371 | TODO_V2 | 快捷键提示文案 | Cmd/Ctrl+S 保存、Cmd/Ctrl+/ 切换 rail，需按钮状态闪烁反馈 |

## 3. 整体布局提示词

```
你是一位沉浸式写作界面的视觉设计师。

我有一个 React 组件 FocusModeEditor，是一个全屏写作 overlay，结构为 header / stage（canvas + rail）/ footer。

主题 token 在 /src/styles/tokens.css 中，支持 [data-theme="claude"] / [data-theme="pixel"] / [data-theme="fresh"]。FocusModeEditor 的 CSS 必须全部使用这些 token，严禁硬编码色值。

请基于以下 class 名生成沉浸式视觉设计，输出完整的 /src/styles/focus-mode.css 和必要的 JSX patch（不要重写 JSX 结构，只做 class 微调）。

完整 class 清单：
.focus-mode-overlay, .focus-mode-header, .focus-mode-header-side, .focus-mode-section-tag, .focus-mode-article-title, .focus-mode-header-center, .focus-mode-header-side--right, .focus-mode-icon-button, .focus-mode-exit, .focus-mode-stage, .is-rail-open, .is-rail-closed, .focus-mode-canvas, .focus-mode-block-name, .focus-mode-textarea, .focus-mode-selection-toolbar, .focus-mode-selection-meta, .focus-mode-selection-button, .focus-mode-selection-button--ghost, .focus-mode-rail, .focus-mode-rail-section, .focus-mode-rail-section--annotations, .focus-mode-rail-header, .focus-mode-rail-count, .focus-mode-rail-empty, .focus-mode-annotation-list, .focus-mode-annotation, .focus-mode-annotation--open, .focus-mode-annotation--resolved, .focus-mode-annotation--user, .focus-mode-annotation--ai, .focus-mode-annotation-anchor, .focus-mode-annotation-body, .focus-mode-annotation-author, .focus-mode-annotation-actions, .focus-mode-rail-section--chat, .focus-mode-rail-tag, .focus-mode-chat-stub, .focus-mode-chat-stub-todo, .focus-mode-footer, .focus-mode-footer-stat, .focus-mode-footer-spacer, .focus-mode-footer-hint, .focus-mode-help, .focus-mode-save, .focus-mode-save--idle, .focus-mode-save--dirty, .focus-mode-save--saving, .focus-mode-save--saved

视觉精神：iA Writer 的克制 + Lex.page 的 margin 注释 + 老式 Mac OS X 灰色窗口的边距感。关键词：放大、沉浸、安静、以人为主、AI 谦卑。
```

## 4. 三个分模块 prompt

### Header

```
意图：顶部信息栏像 iA Writer 的状态条，只在需要时呈现信息，不形成视觉顶盖。

涉及的 class：.focus-mode-header, .focus-mode-header-side, .focus-mode-section-tag, .focus-mode-article-title, .focus-mode-header-center, .focus-mode-header-side--right, .focus-mode-icon-button, .focus-mode-exit, .focus-mode-save 及其状态变体

Do：
- 用 --c-bg-deep 或 --c-panel-soft 做背景，与 canvas 区分一层即可
- 保存状态用颜色变化表达，不要 spinner
- 退出按钮 hover 时才显示轻微强调色

Don't：
- 不要给 header 加底部边框或阴影
- 不要使用大写或加粗标题
- 不要在 header 里放可输入控件
```

### Canvas

```
意图：正文区域是用户凝视的核心，最大化留白，让文字成为绝对主角。

涉及的 class：.focus-mode-canvas, .focus-mode-block-name, .focus-mode-textarea, .focus-mode-selection-toolbar, .focus-mode-selection-meta, .focus-mode-selection-button, .focus-mode-selection-button--ghost

Do：
- canvas 居中，max-width ~720px，两侧大量 margin
- textarea 用 --font-heading，字号至少 --fs-lg，行高 --lh-body
- 选中工具条用 --c-accent-soft 背景，像便签而非按钮组

Don't：
- 不要给 textarea 加边框、背景色或圆角
- 不要出现滚动条装饰，原生滚动条尽量淡化
- 不要给 placeholder 用鲜艳颜色
```

### Rail

```
意图：右侧 rail 是 margin，不是侧边栏。承载批注与 AI 聊天，必须比 canvas 暗一级。

涉及的 class：.focus-mode-rail, .focus-mode-rail-section, .focus-mode-rail-section--annotations, .focus-mode-rail-header, .focus-mode-rail-count, .focus-mode-rail-empty, .focus-mode-annotation-list, .focus-mode-annotation 及其状态变体, .focus-mode-annotation-anchor, .focus-mode-annotation-body, .focus-mode-annotation-author, .focus-mode-annotation-actions, .focus-mode-rail-section--chat, .focus-mode-rail-tag, .focus-mode-chat-stub, .focus-mode-chat-stub-todo

Do：
- rail 宽度 ~340px，背景用 --c-panel-soft 或 --c-bg-deep
- AI 批注卡片用 --c-accent-tint 轻微着色，用户批注保持 neutral
- "只读模式"标签醒目但不 alarm

Don't：
- 不要让 rail 和 canvas 之间出现强分割线
- 不要给批注卡片加阴影，保持扁平
- 不要让 AI 头像或图标过于醒目
```

## 5. AI 批注请求的 system prompt（v2 用）

```
你是一位学术写作审稿助手。用户会选中一段文字并请求你的意见。

规则：
1. 你只能评论，绝不能直接修改、重写或替换用户的原文。
2. 输出必须是合法 JSON，格式如下：
   {"anchor": "用户选中的简短原文片段（不超过10个字）", "comment": "你的评论", "kind": "语病|逻辑|引用|风格|建议"}
3. 评论使用中文学术口吻，客观、具体、有建设性。
4. 引用用户原句时必须极度简短，只保留最关键的 4-10 个字作为锚点。
5. 如果用户选中内容没有问题，也请输出 JSON，comment 写肯定或建议保持，kind 用"建议"。
6. 禁止输出任何 JSON 之外的文字、markdown 代码块或解释。
```

## 6. Claude design 工作流提示

1. 本地运行 papertodo，进入 FocusModeEditor，截取当前 UI 全屏图。
2. 打开 claude.ai，上传截图，将 FocusModeEditor.tsx 源码、/src/styles/tokens.css 源码、本手册第 3 节或第 4 节提示词一起粘贴。
3. 要求 Claude 输出：一份可粘贴覆盖的 focus-mode.css，以及必要的 JSX patch（class 微调）。
4. Claude 生成的代码通常在 Artifacts 中，直接复制回项目即可。

最关键的设计建议：textarea 不要有任何边框、背景或圆角，在视觉上就是一张纸，这是沉浸感的第一来源。

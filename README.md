# SciPaper Todo

本地优先的科研论文写作工作台，用来管理论文写作、审稿回复、学位论文整理和 AI 辅助修改。

Local-first desktop workspace for scientific manuscript writing, review response, thesis assembly, and AI-assisted editing.

[下载最新版 / Latest release](https://github.com/1690834643/scipaper-todo-app/releases/latest) · Windows / macOS · Electron + React + local JSON storage

## 产品截图 / Screenshots

| 主页总览 | 稿件库 |
|---|---|
| ![SciPaper Todo home dashboard](docs/screenshots/promo-home-dashboard.png) | ![SciPaper Todo manuscript library](docs/screenshots/promo-library.png) |

| 稿件工作区 | 沉浸写作 |
|---|---|
| ![SciPaper Todo article workspace](docs/screenshots/promo-article-workspace.png) | ![SciPaper Todo focus writing](docs/screenshots/promo-focus-writing.png) |

| AI 助手 | 设置与集成 |
|---|---|
| ![SciPaper Todo focus writing with AI assistant](docs/screenshots/promo-focus-ai.png) | ![SciPaper Todo settings and integrations](docs/screenshots/promo-settings.png) |

### 三套主题 / Three Themes

| Claude | Pixel | Fresh |
|---|---|---|
| ![SciPaper Todo Claude theme](docs/screenshots/promo-theme-claude.png) | ![SciPaper Todo Pixel theme](docs/screenshots/promo-theme-pixel.png) | ![SciPaper Todo Fresh theme](docs/screenshots/promo-theme-fresh.png) |

## 中文说明

### 这是什么

SciPaper Todo 是一个面向科研写作的桌面应用。它把一篇论文当成一个长期项目来管理，而不是只打开一个孤立的文档。

它会把稿件、参考文献、审稿意见、修改记录、写作进度、附件和 AI 操作都保存在你自己的电脑里。应用按 IMRaD 论文结构组织内容，同时支持学位论文段落、每日科研记录、番茄钟写作，以及一个内置 MCP 服务，让外部 AI 客户端在明确工具边界下读写你的本地项目。

### 主要功能

- IMRaD 论文工作区：Title、Abstract、Introduction、Methods、Results、Discussion、References。
- 沉浸写作模式：TipTap 编辑器、格式工具栏、引用补全、批注栏、AI 抽屉、字数统计、每日目标和番茄钟。
- 本地 AI 助手：支持 OpenAI-compatible 和 Anthropic-compatible provider、场景提示词、流式回复、工具调用审批和写入工具。
- 审稿回复流程：审稿轮次、审稿人意见、修改记录、回复文本、状态追踪和导入辅助。
- 学位论文流程：论文元数据、章节、关联文章、文本块和 Markdown 导出。
- Zotero 集成：本地 Zotero 配置和可供 AI 使用的参考文献上下文。
- 导入能力：支持粘贴、TXT、Markdown、DOCX 和文本型 PDF 的稿件/审稿文本导入。
- 导出能力：Markdown、DOCX、LaTeX、HTML、JSON、分享包和完整备份。
- 写作统计：连续写作、每日字数目标、心情日志、番茄钟记录和进度记录。
- 学术词汇补全：按章节场景工作的科学写作 autocomplete，支持内置和自定义词库包。
- MCP 服务：可连接 Claude Code、Cursor、Kimi Code、Cline、Roo Code、Continue、Windsurf 等 MCP 客户端。

### 最近这一版重点

当前版本重点是让真实写作页对齐设计稿，并让长时间写作更顺滑：

- 写作页浮层固定在主界面之上，并由写作页自己管理滚动区域。
- 工具栏、AI 入口、批注栏、引用补全和番茄钟都保留在沉浸写作模式内。
- 字数统计改为随编辑器变化更新，避免每次 React render 都扫描全文。
- 滚动监听和大纲定位使用 `requestAnimationFrame` 节流。
- 自动补全词库提前建立索引，减少输入时的匹配开销。
- 过大的 `storage.cjs` 已拆成 schema、normalize、db 和业务 facade 四层。
- `db.cjs` 基于数据库 mtime 缓存规范化读取结果，同时向调用方返回可修改副本，避免未保存修改污染缓存。

### 安装

从 Release 页面下载最新版：

https://github.com/1690834643/scipaper-todo-app/releases/latest

Windows：

- `SciPaper-Todo-Setup-x.y.z.exe`：标准安装包，带开始菜单和卸载入口。
- `SciPaper-Todo-Portable-x.y.z.exe`：便携版，直接运行。

macOS：

- `SciPaper-Todo-x.y.z-arm64.dmg` 或 `.zip`：Apple Silicon。
- `SciPaper-Todo-x.y.z-x64.dmg` 或 `.zip`：Intel Mac。
- macOS 包目前未签名。首次打开时可右键选择 Open；如果仍被拦截，可运行：

```bash
xattr -dr com.apple.quarantine /Applications/SciPaper\ Todo.app
```

### 本地数据位置

SciPaper Todo 默认把数据放在：

```text
Documents/SciPaperTodo/
├── database.json
├── database.json.bak
├── Articles/
│   └── {ArticleId}/
│       ├── Attachments/
│       └── Exports/
└── Theses/
```

数据库是本地 JSON 文件。写入时使用临时文件加 rename、`database.json.lock` 文件锁，以及周期性的 `.bak` 备份。Settings 里提供完整备份和恢复。

### 存储层结构

Electron 存储层现在拆成四层：

- `electron/schema.cjs`：常量、路径、章节类型和状态枚举。
- `electron/normalize.cjs`：旧数据迁移和数据规范化。
- `electron/db.cjs`：store 创建、读取缓存、写锁、原子写入和备份恢复。
- `electron/storage.cjs`：暴露给 Electron IPC 和 MCP 工具的业务操作 facade。

这样做的目的不是为了形式上的拆文件，而是降低存储 bug 的定位成本：schema、迁移、文件 I/O、业务操作各自有边界。后续如果继续做性能优化，比如写入批处理或增量状态响应，也不需要反复改文章/审稿/学位论文业务逻辑。

### MCP 使用

MCP 入口是：

```text
electron/mcp-cli.cjs
```

如果在 WSL 或源码环境里接入 MCP 客户端，可以直接指向 Node：

```json
{
  "mcpServers": {
    "scipaper-todo": {
      "command": "node",
      "args": ["/path/to/scipaper-todo/electron/mcp-cli.cjs"],
      "env": {
        "HOME": "/mnt/c/Users/<windows-user>"
      }
    }
  }
}
```

当 MCP 进程不在桌面应用环境里运行时，`HOME` 要指向包含 `Documents/SciPaperTodo` 的用户目录。

### 开发

```bash
npm ci
npm run dev
```

常用命令：

```bash
npm test
npm run lint
npm run build:renderer
npm run dist:win
npm run dist:mac
```

`npm run dev` 会启动 Vite：`http://127.0.0.1:5173/`，并让 Electron 使用这个 renderer。

### 发布流程

仓库内置 GitHub Actions 打包发布：

- 推送 `v*` 标签会运行测试、lint、Windows 打包、macOS 打包，并发布 GitHub Release。
- 也可以从 Actions -> Build & Release -> Run workflow 手动运行，勾选 `publish=true`。

在 WSL 本地交叉构建 Windows 安装包可能受 Wine/rcedit 环境影响。正式发行建议使用 GitHub Actions 的 `windows-latest` 和 `macos-latest`。

### 注意事项

- 应用是 local-first，没有云同步层。
- macOS 包在配置开发者签名前仍是未签名状态。
- 扫描版 PDF 需要先 OCR；文本型 PDF 支持更好。
- 外部 MCP 写入和桌面应用共享同一个文件锁。并发写入会明确失败，不会静默覆盖。

## English

### What It Is

SciPaper Todo is a desktop writing tool for researchers who manage papers as long-running projects rather than one-off documents.

It keeps manuscripts, references, review rounds, writing progress, attachments, and AI actions on your own machine. The app is designed around IMRaD paper writing, but it also includes thesis sections, daily research logs, Pomodoro writing sessions, and a built-in MCP server so external AI clients can read and write your local project with explicit tool boundaries.

### Main Features

- IMRaD paper workspace: Title, Abstract, Introduction, Methods, Results, Discussion, References.
- Focus writing mode: TipTap editor, formatting toolbar, citation autocomplete, annotations, AI drawer, word count, daily goal, and Pomodoro controls.
- Local AI assistant: OpenAI-compatible and Anthropic-compatible providers, scenario prompts, streaming responses, tool-call approval, and write tools.
- Review workflow: review rounds, reviewer comments, revisions, response text, status tracking, and import helpers.
- Thesis workflow: thesis metadata, sections, linked papers, text blocks, and Markdown export.
- Zotero integration: local Zotero config and AI-accessible reference context.
- Imports: manuscript/review text from paste, TXT, Markdown, DOCX, and text-based PDF.
- Exports: Markdown, DOCX, LaTeX, HTML, JSON, share package, full backup.
- Writing analytics: streaks, daily word target, mood log, Pomodoro sessions, progress entries.
- Vocabulary packs: section-aware scientific autocomplete with built-in and custom packs.
- MCP server: stdio entry for Claude Code, Cursor, Kimi Code, Cline, Roo Code, Continue, Windsurf, and other MCP-compatible clients.

### Tech Stack

- Electron 37
- React 19
- TypeScript 6
- Vite 8
- TipTap / ProseMirror
- Vitest
- electron-builder
- `@modelcontextprotocol/sdk`

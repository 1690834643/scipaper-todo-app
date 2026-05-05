<p align="center">
  <img src="build/icon-1024.png" alt="SciPaper Todo" width="160" height="160">
</p>

<h1 align="center">SciPaper Todo</h1>

<p align="center">
  <strong>本地优先的科研论文写作 IDE · Local-first scientific manuscript IDE</strong>
</p>

<p align="center">
  <a href="https://github.com/1690834643/scipaper-todo-app/releases/latest"><img src="https://img.shields.io/github/v/release/1690834643/scipaper-todo-app?style=flat-square&color=2ea44f" alt="release"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue?style=flat-square" alt="platform">
  <img src="https://img.shields.io/badge/electron-37-47848F?style=flat-square" alt="electron">
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square" alt="react">
  <img src="https://img.shields.io/badge/MCP-stdio-F46036?style=flat-square" alt="mcp">
</p>

<p align="center">
  <a href="#中文"><strong>中文说明</strong></a> ·
  <a href="#english"><strong>English</strong></a> ·
  <a href="#截图--screenshots"><strong>截图 / Screenshots</strong></a> ·
  <a href="https://github.com/1690834643/scipaper-todo-app/releases/latest"><strong>下载 / Download</strong></a>
</p>

---

## 截图 / Screenshots

> 写作主战场（沉浸模式）+ 双侧栏可折叠 + AI 抽屉 + IMRaD 章节导航 + 审稿管理 + 多主题。
> Immersive writing canvas + collapsible sidebars + AI drawer + IMRaD nav + review tracking + theme switch.

| 视图 / View | 说明 / What it shows |
|---|---|
| `docs/screenshots/home.png` | 首页：今日写作字数 / 治愈短句 / 快捷入口 — Home dashboard with today's word count and shortcuts |
| `docs/screenshots/library.png` | Library：稿件卡片网格 — Manuscript library grid |
| `docs/screenshots/focus-mode.png` | 沉浸写作：正文区 + 折叠侧栏 + 版本时间线 — Immersive editor with collapsed sidebars + version rail |
| `docs/screenshots/ai-drawer.png` | AI 抽屉 + 工具调用确认 — AI drawer with tool-use approval dialog |
| `docs/screenshots/review.png` | 审稿管理：意见 → ContentBlock 修改关联 — Review workflow linking comments to content blocks |
| `docs/screenshots/settings.png` | Settings：AI Provider / 主题 / Zotero / MCP — Settings (AI / theme / Zotero / MCP) |

截图持续补齐中。欢迎贡献：1080p 截图放到 `docs/screenshots/` 后提 PR / 或贴到 issue 即可。
Screenshots are still being captured. Contributions welcome — drop 1080p PNGs into `docs/screenshots/` via PR or attach in an issue.

---

## 中文

### 这是什么

**SciPaper Todo** 是一款面向生命科学研究者的桌面应用（Windows + macOS），把"写论文"当成一个软件工程项目来管理：

- 一篇论文 = 一个仓库，按 IMRaD 结构组织（Title / Abstract / Introduction / Methods / Results / Discussion / References）
- 数据本地，不上云；附件、版本、修改记录全部留在你机器上
- 内置 MCP 服务器，让 Cursor / Claude Code / Claude Desktop 直接读写你的论文
- 可选接入大模型（DeepSeek 等），AI 助手懂当前章节、当前学科、当前审稿轮次
- 支持 Word 导出，可一键 LLM 自动按学术规范打斜体（`*Chilo suppressalis*` / `*p* < 0.05`）
- Zotero 直连，文献检索 / 全文 / 批注 都能在 AI 对话里自然调用

### 核心特色

| 特色 | 说明 |
|---|---|
| 🧠 **MCP 双向协议** | 内置 stdio MCP server 暴露 81 个工具（76 本地 + 5 Zotero），任何兼容 MCP 的 AI 客户端都能查/写你的论文，包括按学科启停补全词库、导入自定义词库、设置用户名、彻底删稿件 |
| 📚 **IMRaD 一等公民** | 创建论文先回答 4 个研究问题（科学问题 / 现象 / 假设 / 方案），自动生成七章节骨架；ContentBlock 支持文本 / 图片 / 文件链接，每次修改自动版本快照 |
| 🤖 **内置 AI 助手 + 8 场景** | 右侧 Cmd+K Drawer，预置 Abstract / Introduction / Methods / Results / Discussion / Conclusion / Reply Reviewer / Distill 八个场景 prompt，可自定义；支持 OpenAI 与 Anthropic 双协议、思考模式（reasoning_content）流式渲染、工具调用 + 二次确认 |
| 📝 **docx 三模板 + 拉丁斜体规范** | Times New Roman 通用学术 / 宋体 1.5 行距中文学位 / Arial 紧凑 Nature 风格三套模板；勾选"套斜体规范"即可让 LLM 在导出前按学术英语惯例自动给学名 / 拉丁短语 / 统计变量打斜体 |
| 📖 **Zotero 集成** | 通过 zotero-mcp-plugin 直连本地 Zotero（不限版本，6 / 7 / 8 都支持），library 检索 / collection 浏览 / item 详情 / 全文 / 批注 五种查询能力 |
| 🔍 **审稿工作流** | 多轮 ReviewRound + Major/Minor 意见分类 + Revision 关联到具体 ContentBlock + 一键生成回复信草稿 |
| 🎨 **多主题 + 海报分享** | claude / pixel / fresh 三主题 token 化切换；1080×1440 写作打卡海报（含 Latin 引文、印章、波浪线、渐变进度条） |
| 💾 **本地数据安全** | JSON 数据库 + 原子写入（.tmp + rename）+ 5 分钟周期 .bak 备份 + safeStorage 加密的 API Key |
| 🔥 **写作激励** | streak 连续打卡 / 番茄钟会话计数 / 打字字数 / 心情记录 / 每日字数目标 |
| 🅰️ **补全词库分领域可选**（1.0.35） | 11 个内置 pack：核心学术 / 通用分子生物 / IMRaD 四段为默认开；生信工具 / 统计方法 / 鳞翅目昆虫 / 性别决定 / 表观与 RNA 默认关。Settings 里勾选启停，或上传 .txt（一行一词）/ .json 创建自己的 pack；MCP 端 `list_vocab_packs` / `set_vocab_pack_enabled` / `import_vocab_pack` 程序化操作。默认装包不再弹出 doublesex / DSX 这类高度专业的词，泛用性优先 |
| 🎨 **新视觉**（1.0.36） | 米色 squircle + 衬线 "Sci" + 暖珊瑚斜体 "Paper"，7 尺寸（16/24/32/48/64/128/256）真正嵌入 .exe — 之前 1.0.13–1.0.35 由于 electron-builder 的 `signAndEditExecutable: false` 配置一直在用 Electron 默认圆形 logo，本版修复 |
| 🗑️ **稿件彻底删除**（1.0.36） | 稿件库 ✕ 按钮 + 二次确认；同步删除 articles + 解关联 thesis.articleIds + 清空附件目录；MCP `delete_article(articleId)` 暴露给外部 AI 但默认走 approval gate |
| 👤 **个人显示名**（1.0.36） | Settings 里设个名字，侧边栏 brand 区域 + 主页 / 每日日志的时间问候后都会带上（"下午好, 自动挡赛车手"）；空字符串 = 回到默认 "papertodo"；MCP `get_user_profile` / `set_user_profile` 同步可用 |
| 📥 **正文 / 审稿导入助手**（1.0.37） | 文章页提供独立的"导入正文/审稿"入口，和章节里的"导入图片/PDF 附件"明确分开。支持粘贴文本与 `.txt` / `.md` / `.docx` / 文本型 `.pdf`；可按章节导入手稿，或按 Reviewer 分组导入多条审稿意见；导入前预览，导入后可撤销最近一次导入 |
| 🧹 **AI 重排版 / 清理**（1.0.37） | Word/PDF 抽取文本如果带目录、页码、TOC、HYPERLINK、页眉页脚，可在导入助手里点"AI 重排版/清理"。AI 只整理导入框文本，不直接写入；仍需用户看预览后确认 |
| 🧾 **DOCX/PDF 文本抽取修正**（1.0.37） | DOCX 导入会过滤 Word 目录域代码（`TOC` / `HYPERLINK` / `__RefHeading`），避免目录被当正文。PDF 支持文本型 PDF 的 best-effort 抽取；扫描版 PDF 仍需 OCR |
| 🧭 **工作流补齐**（1.0.37） | 新建文章可快速创建草稿；学位论文卡片可打开最小详情页；文章页有"继续写当前章节"主按钮；沉浸编辑退出回当前章节预览；Daily Log 支持未归属进展；AI 上下文提示随当前页面变化 |

### 安装与使用

1. 到 [Releases](https://github.com/1690834643/scipaper-todo-app/releases/latest) 下载：
   - **Windows**：`Setup-x.x.x.exe`（NSIS 安装包，写入 Start Menu / 卸载条目）或 `Portable-x.x.x.exe`（单文件免安装）
   - **macOS arm64**（M1/M2/M3）：`x.x.x-arm64.dmg` 或 `x.x.x-arm64.zip`
   - **macOS x64**（Intel）：`x.x.x-x64.dmg` 或 `x.x.x-x64.zip`
   - 注：macOS 包未签名，首次打开请右键→"打开"，或在终端运行 `xattr -dr com.apple.quarantine /Applications/SciPaper\ Todo.app`
2. 首次启动会在 `%USERPROFILE%\Documents\SciPaperTodo\` 创建数据目录
3. 进 **Settings → AI Provider** 添加你的 LLM（DeepSeek V4 Flash / Pro 已内置预设，粘贴 API Key 即可）
4. 进 **Settings → Zotero 接入**（可选）启用 Zotero 集成
5. 进 **Settings → MCP 协议** 复制配置粘到 Cursor / Claude Code 即可在外部 AI 里读写论文
   - ⚠️ **Windows MCP 配置请用 Setup 版的 .exe**。Portable 版每次启动都会解压到 `%LOCALAPPDATA%\Temp\<随机 hash>\` 一个临时目录，关闭后通常被回收；MCP 配置写的临时路径下次启动就失效。要么用 NSIS Setup（路径固定），要么把 Portable .exe 自己拷到 `C:\Tools\SciPaperTodo\` 这种固定文件夹，MCP 配置指向那个稳定路径。
   - 🐧 **WSL / Linux 用户用 Node 直接跑 MCP**：源码里有一个 `electron/mcp-cli.cjs` 是不带 Electron 壳的 stdio MCP 入口，启动 230 ms，81 个工具全部可用。把客户端 (Claude Code in WSL / Cursor in WSL) 的 MCP 配置改成：
     ```json
     {
       "mcpServers": {
         "scipaper-todo": {
           "command": "node",
           "args": ["/home/<you>/path/to/scipaper-todo/electron/mcp-cli.cjs"],
           "env": { "HOME": "/mnt/c/Users/<your-windows-user>" }
         }
       }
     }
     ```
     `HOME` 这一行是关键——MCP server 默认从 `$HOME/Documents/SciPaperTodo/database.json` 读数据；指到 Windows 用户目录后，WSL 端的 MCP 跟 Windows 桌面应用读同一份数据库。两端写入是用 sentinel-file 锁保护的（`database.json.lock`，O_CREAT\|O_EXCL；超过 30 s 自动清理），同时写不会导致互覆盖——失败的那一方会拿到清晰的"被锁住，请重试"错误。不需要 Windows .exe 桥接。

### 技术栈

- **桌面壳**：Electron 37（Chromium 130+，原生 Canvas 2D L2 / safeStorage / contextBridge 全用上）
- **渲染层**：React 19 + TypeScript 6 + Vite 8（121 modules，gzipped JS 267 KB）
- **写作引擎**：TipTap (ProseMirror) + 自动补全（11 个可启停 pack，默认开 6 个 ≈ 1400 词；启用全部 ≈ 2100 词）+ 行内批注 mark
- **存储**：本地 JSON 数据库 + safeStorage 加密 API Key
- **AI 协议**：OpenAI-compat 与 Anthropic 双协议流式，支持 thinking mode 的 `reasoning_content` 重放
- **MCP**：基于 `@modelcontextprotocol/sdk` 的 stdio server（81 工具：33 读 / 48 写，写工具需环境变量开启）
- **导出**：`docx` v9 纯 JS 包；LaTeX 工程（.tex + references.bib）；HTML / JSON / 分享包
- **导入**：正文 / 审稿导入助手支持 paste、txt、md、docx、文本型 pdf；DOCX 目录域过滤；可选 LLM 清理；写入前预览、写入后可撤销最近批次
- **打包**：electron-builder 出 NSIS + Portable + macOS arm64/x64 共 6 产物；Windows 发行版通过 GitHub Actions 在 `windows-latest` 上构建，避免 WSL 本地缺少 `wine32` 时卡在 rcedit

### 发行版构建

- **推荐方式**：推送 `v1.0.37` 这类 tag 后，GitHub Actions 会运行测试、lint、Windows 打包，并把 `Setup` / `Portable` / `.blockmap` 上传到 GitHub Release。
- **手动方式**：在 GitHub 的 **Actions → Build & Release → Run workflow** 里触发，构建产物会作为 workflow artifact 上传；勾选 `publish` 时会发布到对应 tag 的 Release。
- **本地 Windows**：`npm ci && npm run dist:win`。
- **WSL/Linux 交叉打 Windows 包**：需要完整 Wine 32-bit 环境；否则会在 electron-builder 的 Windows 资源编辑步骤失败。一般直接用 GitHub Actions。

### 路径速查

```
%USERPROFILE%\Documents\SciPaperTodo\
├── database.json           # 主数据库（原子写入）
├── database.json.bak       # 5 分钟周期备份
├── Articles\
│   └── {ArticleId}\
│       ├── Attachments\    # 复制进来的图片 / 数据文件
│       └── Exports\        # 导出的 docx / md
└── Theses\                 # 学位论文（聚合多篇 article）
```

### 谁适合用

- 生命科学博士生 / 博后 / 青年 PI（默认场景）
- 任何 IMRaD 写作者，特别是要管理 **多篇并行 + 多轮审稿** 的人
- 想把 AI 真正接到自己写作流程里、又不愿把数据交给云的人

### 反馈与已知

- macOS 包未签名 / 未公证（暂无 Apple Developer 证书）；首次打开 Gatekeeper 拦截需右键→"打开"，或 `xattr -dr com.apple.quarantine` 解除
- Linux 暂无二进制（代码跨平台，需自编译）
- 旧 `deepseek-chat` / `deepseek-reasoner` model id 已在 V4 文档里被标记为 legacy；预设直接给 `deepseek-v4-flash` / `deepseek-v4-pro`
- WSL 下 safeStorage 拒保存 API Key（Windows 实机用 DPAPI 正常）；如遇此情况只在 Windows 跑
- **Portable .exe 用作 MCP server 路径不稳定**：Windows portable NSIS 会把 .exe 自解压到 `%LOCALAPPDATA%\Temp\<随机 hash>\`，关闭后被清理，hash 每次启动可能变；任何外部 MCP 客户端把这个临时路径写死，下次连接就会找不到。要把 SciPaper Todo 当 MCP 服务器，请用 Setup 版（路径固定到安装目录），或把 Portable .exe 拷到自己常驻的固定文件夹再在 MCP 配置里指向那条路径。

---

## English

### What is this

**SciPaper Todo** is a desktop app (Windows + macOS) for life-science researchers that treats manuscript writing like a software project:

- One paper = one repository, organised by IMRaD (Title / Abstract / Introduction / Methods / Results / Discussion / References)
- Local-first. Attachments, versions, edit history all stay on your machine
- Built-in MCP server lets Cursor / Claude Code / Claude Desktop read and write your manuscripts directly
- Optional LLM integration (DeepSeek and others). The assistant knows your current section, field, and review round
- Word export with one-click LLM auto-italicisation per academic conventions (`*Chilo suppressalis*` / `*p* < 0.05`)
- Direct Zotero integration: search, fulltext, annotations all callable from chat

### Key features

| Feature | What it does |
|---|---|
| 🧠 **Bidirectional MCP** | Built-in stdio MCP server exposes 81 tools (76 local + 5 Zotero). Any MCP-compatible AI client can query and write to your manuscripts, including toggling per-discipline autocomplete packs, importing custom vocabulary, setting your display name, and hard-deleting articles |
| 📚 **IMRaD as a first-class citizen** | Creating a paper starts with 4 research questions (problem / phenomenon / hypothesis / approach) that auto-generate the 7-section skeleton. Content blocks support text / image / file link, with automatic version snapshots on every edit |
| 🤖 **Built-in AI drawer + 8 scenarios** | Right-side Cmd+K drawer with preset prompts for Abstract / Introduction / Methods / Results / Discussion / Conclusion / Reply Reviewer / Distill, all customisable. OpenAI and Anthropic protocols, streaming `reasoning_content` for thinking-mode models, tool-calling with confirm-before-write |
| 📝 **3 docx templates + Latin italic guide** | Times New Roman academic / SimSun 1.5-spacing thesis / Arial Nature-style. Tick "apply italic guide" and the exporter calls the LLM to mark italics on species names, Latin phrases, and statistical variables before writing the docx |
| 📖 **Zotero integration** | Via zotero-mcp-plugin (works with Zotero 6/7/8): library search, collection browsing, item details, fulltext, annotations |
| 🔍 **Review workflow** | Multiple ReviewRounds, Major/Minor tagging, Revisions linked to specific ContentBlocks, one-click response-letter draft |
| 🎨 **Themes + share posters** | Three token-based themes (claude / pixel / fresh). Generates 1080×1440 daily-writing posters with Latin epigraph, seal, waveform, gradient progress |
| 💾 **Safe local storage** | JSON database with atomic writes (.tmp + rename), rolling 5-minute .bak snapshot, API keys encrypted via safeStorage |
| 🔥 **Writing motivation** | Streak counter, pomodoro session log, daily word target, mood log, typing-burst stats |
| 🅰️ **Pluggable vocabulary packs** (1.0.35) | 11 built-in packs. Default-on: core-academic, molecular-biology, four IMRaD section packs. Default-off: bioinformatics-tools, statistics-methods, lepidoptera-insect, sex-determination, epigenetics-rna. Toggle in Settings, or upload .txt (one word per line) / .json to create your own pack. The MCP surface mirrors this with `list_vocab_packs` / `set_vocab_pack_enabled` / `import_vocab_pack`. Out of the box, highly specialised terms (doublesex, DMRT, m6A …) no longer surface — opt in per discipline |
| 🎨 **New visual identity** (1.0.36) | Beige squircle + serif "Sci" + warm-coral italic "Paper", with all 7 sizes (16/24/32/48/64/128/256) actually embedded in the .exe. Earlier 1.0.13–1.0.35 builds shipped Electron's default circular logo because `signAndEditExecutable: false` in electron-builder silently disabled rcedit; this release fixes it |
| 🗑️ **Hard-delete articles** (1.0.36) | ✕ button on the library card with a confirmation dialog; removes the article, unlinks it from any thesis, wipes its attachment directory. The MCP `delete_article(articleId)` exposes the same operation to external AIs but routes through the approval gate |
| 👤 **Display name** (1.0.36) | Set a name in Settings and it shows in the sidebar brand area plus the time-of-day greetings on Home and Daily Log ("Good afternoon, Wei"). Empty = falls back to "papertodo". MCP `get_user_profile` / `set_user_profile` mirror this for programmatic control |
| 📥 **Manuscript / review import assistant** (1.0.37) | The Article workspace now has a dedicated "import manuscript/reviews" entry, separate from section attachment import. Supports pasted text and `.txt` / `.md` / `.docx` / text-based `.pdf`; imports manuscript sections or reviewer-grouped comments with preview-before-write and undo-last-import |
| 🧹 **AI reformat / cleanup** (1.0.37) | If Word/PDF extraction includes TOC, page numbers, HYPERLINK fields, headers, or broken line breaks, click "AI reformat/cleanup" inside the import assistant. It only cleans the import text; writes still require preview confirmation |
| 🧾 **DOCX/PDF extraction fixes** (1.0.37) | DOCX extraction filters Word TOC field codes (`TOC` / `HYPERLINK` / `__RefHeading`). PDF import has best-effort text extraction for text-based PDFs; scanned PDFs still need OCR |
| 🧭 **Workflow completion pass** (1.0.37) | Quick draft creation, minimal thesis detail view, clear continue-writing action, editor exit back to current-section preview, unassigned Daily Log entries, and route-aware AI context hints |

### Install

1. Grab from [Releases](https://github.com/1690834643/scipaper-todo-app/releases/latest):
   - **Windows**: `Setup-x.x.x.exe` (NSIS installer with Start Menu / uninstall entry) or `Portable-x.x.x.exe` (single-file binary)
   - **macOS arm64** (M1/M2/M3): `x.x.x-arm64.dmg` or `x.x.x-arm64.zip`
   - **macOS x64** (Intel): `x.x.x-x64.dmg` or `x.x.x-x64.zip`
   - macOS builds are unsigned. First open: right-click → "Open", or run `xattr -dr com.apple.quarantine /Applications/SciPaper\ Todo.app`
2. First launch creates `%USERPROFILE%\Documents\SciPaperTodo\`
3. **Settings → AI Provider**: add your LLM (DeepSeek V4 Flash / Pro presets included, paste your API key)
4. **Settings → Zotero** (optional): enable Zotero integration
5. **Settings → MCP**: copy the config block into Cursor / Claude Code to give external AIs access
   - ⚠️ **On Windows, use the Setup .exe for MCP integration, not Portable.** Portable launches by self-extracting to `%LOCALAPPDATA%\Temp\<random-hash>\` and the hash changes between runs; an MCP config pinned to that temp path breaks the next time you reopen the app. Either install via NSIS Setup (stable install path), or copy the Portable .exe into a fixed folder such as `C:\Tools\SciPaperTodo\` and point your MCP config there.
   - 🐧 **WSL / Linux: skip the .exe bridge and run the MCP server natively via Node.** The repo ships `electron/mcp-cli.cjs`, an Electron-free stdio MCP entry. ~230 ms cold start, all 81 tools live. Point your WSL-side client at:
     ```json
     {
       "mcpServers": {
         "scipaper-todo": {
           "command": "node",
           "args": ["/home/<you>/path/to/scipaper-todo/electron/mcp-cli.cjs"],
           "env": { "HOME": "/mnt/c/Users/<your-windows-user>" }
         }
       }
     }
     ```
     The `HOME` override is what makes the WSL-side MCP read the same `Documents/SciPaperTodo/database.json` your Windows GUI writes. Concurrent writes are guarded by a sentinel-file lock (`database.json.lock`, `O_CREAT|O_EXCL`, auto-reclaimed after 30 s of staleness): the loser of a race gets a clear "DB is locked, retry" error rather than a silent overwrite. No `.exe` is involved on this path.

### Stack

- **Shell**: Electron 37 (Chromium 130+, uses Canvas 2D Level 2, safeStorage, contextBridge)
- **Renderer**: React 19 + TypeScript 6 + Vite 8 (121 modules, ~267 KB gzipped JS)
- **Editor**: TipTap (ProseMirror) with pluggable autocomplete (11 toggleable packs; ~1400 words active by default, ~2100 words across the full registry) and inline annotation marks
- **Storage**: local JSON database + encrypted API key store
- **AI**: dual-protocol streaming (OpenAI-compat + Anthropic), with `reasoning_content` replay for thinking-mode models
- **MCP**: stdio server on `@modelcontextprotocol/sdk` (81 tools: 33 read / 48 write, writes gated by env flag)
- **Export**: `docx` v9 (pure JS); LaTeX project (.tex + references.bib); HTML / JSON / share bundle
- **Import**: manuscript / review import assistant for paste, txt, md, docx, and text-based pdf; DOCX TOC filtering; optional LLM cleanup; preview-before-write; undo-last-import
- **Packaging**: electron-builder ships NSIS + Portable + macOS arm64 / x64. Windows releases are built on GitHub Actions `windows-latest`, avoiding local WSL `wine32` / rcedit failures.

### Release Build

- **Recommended**: push a tag such as `v1.0.37`; GitHub Actions runs tests, lint, Windows packaging, then uploads `Setup`, `Portable`, and `.blockmap` files to the GitHub Release.
- **Manual**: run **Actions → Build & Release → Run workflow** in GitHub; artifacts are uploaded to the workflow run, and checking `publish` attaches them to the matching tag release.
- **Local Windows**: `npm ci && npm run dist:win`.
- **WSL/Linux cross-build**: requires a full 32-bit Wine setup for electron-builder's Windows resource editing. Use GitHub Actions unless you specifically need local packaging.

### Paths

```
%USERPROFILE%\Documents\SciPaperTodo\
├── database.json           # Main database (atomic writes)
├── database.json.bak       # Rolling 5-minute backup
├── Articles\
│   └── {ArticleId}\
│       ├── Attachments\    # Copied figures / raw data files
│       └── Exports\        # Generated docx / md
└── Theses\                 # Degree theses (aggregate of multiple articles)
```

### Who is this for

- Life-science PhD students, postdocs, early-career PIs (default audience)
- Any IMRaD writer juggling multiple manuscripts and review rounds
- Anyone who wants AI in their writing flow but does not want their data on a vendor's cloud

### Caveats

- macOS builds are unsigned / un-notarised (no Apple Developer cert yet). First launch hits Gatekeeper — right-click → "Open", or run `xattr -dr com.apple.quarantine` to clear the quarantine attribute
- No Linux binaries (codebase is cross-platform, build from source)
- Legacy `deepseek-chat` / `deepseek-reasoner` model IDs are deprecated per DeepSeek docs; presets ship with `deepseek-v4-flash` / `deepseek-v4-pro`
- safeStorage refuses to persist API keys under WSL; run the actual binary on Windows for full functionality
- **Portable .exe is unstable as an MCP server target.** The Windows NSIS portable wrapper self-extracts to `%LOCALAPPDATA%\Temp\<random-hash>\`, gets cleaned up on close, and may pick a new hash on the next run. Any external MCP client config pinned to that path will fail next session. To use SciPaper Todo as an MCP server, install via Setup (stable path), or copy the Portable .exe into a fixed folder of your own and point the MCP config there.
